// Pure calendar-grid layout math — month/week date grids and timed-block
// positioning. Deliberately has zero knowledge of house_events, Recurrence,
// or the DB (kept separate from lib/events.ts for the same reason
// lib/recurring.ts and lib/events.ts are kept separate — different concern,
// different blast radius; this file is just "what dates form a grid" and
// "how do overlapping blocks pack," reusable for any date-shaped input).
// Imports only from lib/date-strings.ts (zero dependencies), never from
// lib/events.ts (which pulls in db/telegram) — this module is safe to import
// from client components, unlike lib/events.ts.
import { parseDate, fmtDate, addDays } from "@/lib/date-strings";

function weekdayMondayIndex(dateStr: string): number {
  const { y, m, d } = parseDate(dateStr);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (dow + 6) % 7; // 0=Mon..6=Sun
}

// The 42 (6x7) Y-M-D dates for a Monday-start month grid, including
// leading/trailing days from adjacent months. Always 6 rows so grid height
// is consistent across months.
export function getMonthGridDates(year: number, month: number): string[] {
  const firstOfMonth = fmtDate(year, month, 1);
  const gridStart = addDays(firstOfMonth, -weekdayMondayIndex(firstOfMonth));
  const dates: string[] = [];
  for (let i = 0; i < 42; i++) dates.push(addDays(gridStart, i));
  return dates;
}

// The 7 Y-M-D dates (Monday-start) for the week containing anchorDate.
export function getWeekDates(anchorDate: string): string[] {
  const weekStart = addDays(anchorDate, -weekdayMondayIndex(anchorDate));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) dates.push(addDays(weekStart, i));
  return dates;
}

export function minutesFromTimeString(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export type TimedItem = {
  startMinutes: number;
  endMinutes: number; // caller picks a sensible default (e.g. +30min) for point-in-time events with no end
};

export type PositionedBlock<T extends TimedItem> = {
  item: T;
  column: number;
  columns: number;
  topPercent: number;
  heightPercent: number;
};

// Greedy interval-overlap column packing for a single day's timed events, so
// overlapping events render side-by-side instead of stacked. Intentionally
// the simple O(n^2) version — fine at household event volume, not an
// interval-tree. Groups items into maximal overlapping clusters first so
// unrelated later-in-day events aren't squeezed by an earlier cluster's
// column count.
export function layoutDayTimedBlocks<T extends TimedItem>(items: T[]): PositionedBlock<T>[] {
  const DAY_MINUTES = 24 * 60;
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  );
  const result: PositionedBlock<T>[] = [];

  const flushCluster = (cluster: T[]) => {
    const columnEnds: number[] = [];
    const columnByItem = new Map<T, number>();
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.startMinutes);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.endMinutes);
      } else {
        columnEnds[col] = item.endMinutes;
      }
      columnByItem.set(item, col);
    }
    const columns = columnEnds.length;
    for (const item of cluster) {
      result.push({
        item,
        column: columnByItem.get(item)!,
        columns,
        topPercent: (item.startMinutes / DAY_MINUTES) * 100,
        heightPercent: Math.max(((item.endMinutes - item.startMinutes) / DAY_MINUTES) * 100, 2),
      });
    }
  };

  let cluster: T[] = [];
  let clusterEnd = -Infinity;
  for (const item of sorted) {
    if (cluster.length === 0 || item.startMinutes < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
    } else {
      flushCluster(cluster);
      cluster = [item];
      clusterEnd = item.endMinutes;
    }
  }
  if (cluster.length) flushCluster(cluster);

  return result;
}
