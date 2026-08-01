"use server";

import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { type Recurrence, formatEventDate, formatEventTime } from "@/lib/events";
import { notifyHouse, renderEventCreatedMessage } from "@/lib/telegram";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildCalendarData, type CalendarViewMode } from "./calendar-data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FormState = { error?: string } | undefined;

function parseRecurrence(formData: FormData): Recurrence {
  const freq = String(formData.get("freq"));
  switch (freq) {
    case "none":
      return { freq: "none" };
    case "monthly": {
      const day = Number(formData.get("monthlyDay"));
      if (!Number.isInteger(day) || day < 1 || day > 31)
        throw new Error("Day of month must be between 1 and 31.");
      return { freq: "monthly", day };
    }
    case "months": {
      const interval = Number(formData.get("monthsInterval"));
      if (!Number.isInteger(interval) || interval < 1)
        throw new Error("Enter a valid interval in months.");
      return { freq: "months", interval };
    }
    case "yearly":
      return { freq: "yearly" };
    default:
      throw new Error("Pick a recurrence.");
  }
}

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, me } = await requireMember(slug);
  const eventId = formData.get("eventId") ? Number(formData.get("eventId")) : null;

  try {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) throw new Error("Enter a title.");
    const note = String(formData.get("note") ?? "").trim() || null;
    const nextDate = String(formData.get("nextDate"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) throw new Error("Pick a valid date.");

    const allDay = formData.get("allDay") === "on";
    const startTimeRaw = String(formData.get("startTime") ?? "").trim();
    const endTimeRaw = String(formData.get("endTime") ?? "").trim();
    const startTime = allDay ? null : startTimeRaw || null;
    const endTime = allDay ? null : endTimeRaw || null;
    if (startTime && !TIME_RE.test(startTime)) throw new Error("Pick a valid start time.");
    if (endTime && !TIME_RE.test(endTime)) throw new Error("Pick a valid end time.");
    if (endTime && !startTime) throw new Error("Add a start time first.");
    if (startTime && endTime && endTime <= startTime)
      throw new Error("End time must be after start time.");

    const remindDaysBefore = Number(formData.get("remindDaysBefore"));
    if (!Number.isInteger(remindDaysBefore) || remindDaysBefore < 0)
      throw new Error("Remind days before must be 0 or more.");
    const active = formData.get("active") === "on" ? 1 : 0;
    const recurrence = parseRecurrence(formData);

    const values = { title, note, nextDate, startTime, endTime, recurrence, remindDaysBefore, active };

    if (eventId) {
      const existing = await db().query.houseEvents.findFirst({
        where: and(eq(houseEvents.id, eventId), eq(houseEvents.houseId, house.id)),
      });
      if (!existing) throw new Error("Event not found.");
      // No notification on edit — the doc calls this out explicitly as noise.
      await db().update(houseEvents).set(values).where(eq(houseEvents.id, eventId));
    } else {
      await db()
        .insert(houseEvents)
        .values({ ...values, houseId: house.id, createdBy: me.id });
      await notifyHouse(
        house.id,
        renderEventCreatedMessage({
          title,
          dateLabel: formatEventDate(nextDate),
          createdByName: me.username,
          timeLabel: formatEventTime(startTime, endTime),
        })
      );
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(`/h/${slug}/app/events`);
  revalidatePath(`/h/${slug}/app`);
  redirect(`/h/${slug}/app/events`);
}

export async function deleteEvent(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const id = Number(formData.get("eventId"));
  await db()
    .delete(houseEvents)
    .where(and(eq(houseEvents.id, id), eq(houseEvents.houseId, house.id)));
  revalidatePath(`/h/${slug}/app/events`);
  revalidatePath(`/h/${slug}/app`);
  redirect(`/h/${slug}/app/events`);
}

// Read action for client-side calendar navigation (prev/next/today/toggle) so
// it doesn't need a full page reload. Re-authorizes like every other action
// (Invariant 6) even though it only reads.
export async function getCalendarData(slug: string, view: CalendarViewMode, anchorDate: string) {
  const { house } = await requireMember(slug);
  return buildCalendarData(house.id, view, anchorDate);
}
