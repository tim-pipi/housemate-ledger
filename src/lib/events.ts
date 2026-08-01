import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sgToday, daysInMonth } from "@/lib/recurring";
import { notifyHouse, renderEventReminderMessage } from "@/lib/telegram";
import { parseDate, fmtDate, addDays } from "@/lib/date-strings";

// Re-exported so existing callers of lib/events.ts don't need a second
// import; lib/calendar-grid.ts (client-safe) imports these from
// lib/date-strings.ts directly instead, since this module pulls in db/telegram
// and must never be imported by a "use client" component.
export { parseDate, fmtDate, addDays };

// Deliberately minimal — not full rrule. Every real use case named so far
// (rent, aircon every 4 months, dinners) fits these four variants.
export type Recurrence =
  | { freq: "none" } // one-off
  | { freq: "monthly"; day: number } // day 1-31, clamped in short months
  | { freq: "months"; interval: number } // anchored on next_date
  | { freq: "yearly" };

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

// "HH:MM" (24h) -> "7:00 PM" / "7:00–9:00 PM". null when all-day. Pure string
// formatting, no timezone conversion — a wall-clock label, same philosophy as
// formatEventDate.
export function formatEventTime(startTime: string | null, endTime: string | null): string | null {
  if (!startTime) return null;
  const label = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return endTime ? `${label(startTime)}–${label(endTime)}` : label(startTime);
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

type HouseEventRow = typeof houseEvents.$inferSelect;

function addMonthsClamped(
  y: number,
  m: number,
  d: number,
  deltaMonths: number
): { y: number; m: number; d: number } {
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
}

// Pure projection of an event's recurrence rule onto a date range, for
// calendar-grid display only — never touches the DB, `active`, or
// `lastRemindedOn`. house_events still only ever persists the single next
// occurrence (nextDate) plus the rule; this just answers "what would this
// rule show between rangeStart and rangeEnd." It has no opinion on `active`;
// callers decide which projected dates to keep for a paused event (see
// Invariant #12 in CLAUDE.md — one-offs always show, paused recurring events
// only show occurrences on or before today).
export function projectOccurrences(
  event: Pick<HouseEventRow, "nextDate" | "recurrence">,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const recurrence = event.recurrence as Recurrence;
  const inRange = (d: string) => d >= rangeStart && d <= rangeEnd;

  switch (recurrence.freq) {
    case "none":
      return inRange(event.nextDate) ? [event.nextDate] : [];

    case "monthly": {
      const start = parseDate(rangeStart);
      const end = parseDate(rangeEnd);
      const dates: string[] = [];
      let y = start.y,
        m = start.m;
      while (y < end.y || (y === end.y && m <= end.m)) {
        const day = Math.min(recurrence.day, daysInMonth(y, m));
        const d = fmtDate(y, m, day);
        if (inRange(d)) dates.push(d);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
      return dates;
    }

    case "months": {
      const anchor = parseDate(event.nextDate);
      const dates: string[] = [];
      // Bounded walk in both directions from the anchor — ±60 steps covers
      // several decades at any realistic interval, far beyond how far a
      // household would ever navigate the calendar.
      for (let step = -60; step <= 60; step++) {
        const { y, m, d } = addMonthsClamped(anchor.y, anchor.m, anchor.d, step * recurrence.interval);
        const date = fmtDate(y, m, d);
        if (inRange(date)) dates.push(date);
      }
      return dates.sort();
    }

    case "yearly": {
      const anchor = parseDate(event.nextDate);
      const start = parseDate(rangeStart);
      const end = parseDate(rangeEnd);
      const dates: string[] = [];
      for (let y = start.y - 1; y <= end.y + 1; y++) {
        const day = Math.min(anchor.d, daysInMonth(y, anchor.m));
        const d = fmtDate(y, anchor.m, day);
        if (inRange(d)) dates.push(d);
      }
      return dates;
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
    const timeLabel = formatEventTime(e.startTime, e.endTime);

    const remindDate = addDays(e.nextDate, -e.remindDaysBefore);
    if (today === remindDate && e.lastRemindedOn !== today) {
      await notifyHouse(
        e.houseId,
        renderEventReminderMessage({ title: e.title, note: e.note, recurrenceLabel, when: "tomorrow", timeLabel })
      );
      await db().update(houseEvents).set({ lastRemindedOn: today }).where(eq(houseEvents.id, e.id));
      reminded++;
      continue;
    }

    if (e.remindDaysBefore > 0 && today === e.nextDate && e.lastRemindedOn !== today) {
      await notifyHouse(
        e.houseId,
        renderEventReminderMessage({ title: e.title, note: e.note, recurrenceLabel, when: "today", timeLabel })
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
