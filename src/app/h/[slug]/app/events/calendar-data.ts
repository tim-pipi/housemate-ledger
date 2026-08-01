import { db } from "@/db";
import { houseEvents, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sgToday } from "@/lib/recurring";
import { getMonthGridDates, getWeekDates } from "@/lib/calendar-grid";
import { projectOccurrences, formatEventTime, type Recurrence } from "@/lib/events";

export type CalendarViewMode = "month" | "week";

export type CalendarOccurrence = {
  id: number;
  title: string;
  note: string | null;
  active: boolean;
  startTime: string | null;
  endTime: string | null;
  timeLabel: string | null;
  color: string;
};

export type CalendarData = {
  view: CalendarViewMode;
  anchorDate: string;
  gridDates: string[];
  todayDate: string;
  occurrencesByDate: Record<string, CalendarOccurrence[]>;
};

// Shared by events/page.tsx (initial server-rendered load) and the
// getCalendarData action (client-side nav) so there's one fetch+project path.
// Fetches all house_events for the house (household scale — well under a few
// hundred rows ever — so no date-range SQL is needed) and projects each
// event's occurrences over the visible grid range in memory. Never writes
// anything; house_events storage and runEventScan()'s reminder/roll-over
// logic are completely untouched by this read path.
export async function buildCalendarData(
  houseId: number,
  view: CalendarViewMode,
  anchorDate: string
): Promise<CalendarData> {
  const { year, month, day } = sgToday();
  const todayDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const [ay, am] = anchorDate.split("-").map(Number);
  const gridDates = view === "month" ? getMonthGridDates(ay, am) : getWeekDates(anchorDate);
  const rangeStart = gridDates[0];
  const rangeEnd = gridDates[gridDates.length - 1];

  const [events, houseMembers] = await Promise.all([
    db().query.houseEvents.findMany({ where: eq(houseEvents.houseId, houseId) }),
    db().query.members.findMany({
      where: eq(members.houseId, houseId),
      columns: { id: true, color: true },
    }),
  ]);
  const colorByMember = new Map(houseMembers.map((m) => [m.id, m.color]));

  const occurrencesByDate: Record<string, CalendarOccurrence[]> = {};
  for (const date of gridDates) occurrencesByDate[date] = [];

  for (const e of events) {
    const recurrence = e.recurrence as Recurrence;
    const raw = projectOccurrences(e, rangeStart, rangeEnd);
    // One-off events always show at their stored date regardless of `active`
    // (calendar history is preserved). Recurring events project freely while
    // active; once paused, only occurrences on or before today keep showing —
    // future projection stops immediately, past history does not disappear.
    // See CLAUDE.md Invariant #12.
    const dates =
      recurrence.freq === "none" || e.active === 1 ? raw : raw.filter((d) => d <= todayDate);
    if (dates.length === 0) continue;

    const item: CalendarOccurrence = {
      id: e.id,
      title: e.title,
      note: e.note,
      active: e.active === 1,
      startTime: e.startTime,
      endTime: e.endTime,
      timeLabel: formatEventTime(e.startTime, e.endTime),
      color: colorByMember.get(e.createdBy) ?? "#0E7C6B",
    };
    for (const date of dates) {
      occurrencesByDate[date]?.push(item);
    }
  }

  return { view, anchorDate, gridDates, todayDate, occurrencesByDate };
}
