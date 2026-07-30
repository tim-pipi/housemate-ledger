import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sgToday, daysInMonth } from "@/lib/recurring";
import { notifyHouse, renderEventReminderMessage } from "@/lib/telegram";

// Deliberately minimal — not full rrule. Every real use case named so far
// (rent, aircon every 4 months, dinners) fits these four variants.
export type Recurrence =
  | { freq: "none" } // one-off
  | { freq: "monthly"; day: number } // day 1-31, clamped in short months
  | { freq: "months"; interval: number } // anchored on next_date
  | { freq: "yearly" };

function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDate(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return fmtDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// Human-readable date for messages/UI, e.g. "Sat 8 Aug". Formatted from the
// plain Y-M-D components directly (no timezone conversion) — next_date is
// already a calendar date in SGT semantics, not an instant.
export function formatEventDate(dateStr: string): string {
  const { y, m, d } = parseDate(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

export function describeRecurrence(r: Recurrence): string {
  switch (r.freq) {
    case "none":
      return "one-off";
    case "monthly":
      return `monthly on day ${r.day}`;
    case "months":
      return `every ${r.interval} month${r.interval === 1 ? "" : "s"}`;
    case "yearly":
      return "yearly";
  }
}

// Computes the next occurrence after `current` per the recurrence rule, or
// null for one-off events (caller should deactivate instead).
export function advanceNextDate(current: string, recurrence: Recurrence): string | null {
  const { y, m, d } = parseDate(current);
  switch (recurrence.freq) {
    case "none":
      return null;
    case "monthly": {
      let ny = y,
        nm = m + 1;
      if (nm > 12) {
        nm = 1;
        ny++;
      }
      const day = Math.min(recurrence.day, daysInMonth(ny, nm));
      return fmtDate(ny, nm, day);
    }
    case "months": {
      const total = (y * 12 + (m - 1)) + recurrence.interval;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
      const day = Math.min(d, daysInMonth(ny, nm));
      return fmtDate(ny, nm, day);
    }
    case "yearly": {
      const ny = y + 1;
      const day = Math.min(d, daysInMonth(ny, m));
      return fmtDate(ny, m, day);
    }
  }
}

// Daily scan: send due reminders and roll dates forward. Called from the
// /api/digest route (already runs daily) — never from /api/cron, which is
// exclusively the recurring-bill ledger path. All steps are idempotent via
// lastRemindedOn, so reruns the same day send nothing twice.
export async function runEventScan(): Promise<{
  reminded: number;
  advanced: number;
  deactivated: number;
}> {
  const { ym, day } = sgToday();
  const today = `${ym}-${String(day).padStart(2, "0")}`;

  const events = await db().query.houseEvents.findMany({ where: eq(houseEvents.active, 1) });
  let reminded = 0,
    advanced = 0,
    deactivated = 0;

  for (const e of events) {
    const recurrence = e.recurrence as Recurrence;

    const recurrenceLabel = recurrence.freq === "none" ? null : describeRecurrence(recurrence);

    const remindDate = addDays(e.nextDate, -e.remindDaysBefore);
    if (today === remindDate && e.lastRemindedOn !== today) {
      await notifyHouse(
        e.houseId,
        renderEventReminderMessage({ title: e.title, note: e.note, recurrenceLabel, when: "tomorrow" })
      );
      await db().update(houseEvents).set({ lastRemindedOn: today }).where(eq(houseEvents.id, e.id));
      reminded++;
      continue;
    }

    if (e.remindDaysBefore > 0 && today === e.nextDate && e.lastRemindedOn !== today) {
      await notifyHouse(
        e.houseId,
        renderEventReminderMessage({ title: e.title, note: e.note, recurrenceLabel, when: "today" })
      );
      await db().update(houseEvents).set({ lastRemindedOn: today }).where(eq(houseEvents.id, e.id));
      reminded++;
      continue;
    }

    if (today > e.nextDate) {
      const next = advanceNextDate(e.nextDate, recurrence);
      if (next === null) {
        await db().update(houseEvents).set({ active: 0 }).where(eq(houseEvents.id, e.id));
        deactivated++;
      } else {
        await db().update(houseEvents).set({ nextDate: next }).where(eq(houseEvents.id, e.id));
        advanced++;
      }
    }
  }

  return { reminded, advanced, deactivated };
}
