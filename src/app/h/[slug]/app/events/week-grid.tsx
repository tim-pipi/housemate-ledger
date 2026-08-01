import Link from "next/link";
import { layoutDayTimedBlocks, minutesFromTimeString, type PositionedBlock } from "@/lib/calendar-grid";
import type { CalendarData, CalendarOccurrence } from "./calendar-data";

const HOUR_PX = 48;

type TimedOccurrence = CalendarOccurrence & { startMinutes: number; endMinutes: number };
type Block = PositionedBlock<TimedOccurrence>;

function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function dayHeader(dateStr: string): { weekday: string; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(dt);
  return { weekday, day: d };
}

export function WeekGrid({ slug, data }: { slug: string; data: CalendarData }) {
  const days: { date: string; allDay: CalendarOccurrence[]; blocks: Block[] }[] = data.gridDates.map(
    (date) => {
      const occurrences = data.occurrencesByDate[date] ?? [];
      const allDay = occurrences.filter((o) => !o.startTime);
      const timed: TimedOccurrence[] = occurrences
        .filter((o) => o.startTime)
        .map((o) => ({
          ...o,
          startMinutes: minutesFromTimeString(o.startTime!),
          endMinutes: o.endTime ? minutesFromTimeString(o.endTime) : minutesFromTimeString(o.startTime!) + 30,
        }));
      return { date, allDay, blocks: layoutDayTimedBlocks(timed) };
    }
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] rounded-xl border border-line bg-white shadow-card">
        {/* Header */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line">
          <div />
          {days.map(({ date }) => {
            const { weekday, day } = dayHeader(date);
            const isToday = date === data.todayDate;
            return (
              <div key={date} className="border-l border-line py-1.5 text-center text-xs">
                <div className="text-inkmuted">{weekday}</div>
                <div
                  className={`tnum mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                    isToday ? "bg-accent font-semibold text-white" : "text-ink"
                  }`}
                >
                  {day}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line">
          <div className="py-1 text-right text-[10px] text-inkmuted">All day</div>
          {days.map(({ date, allDay }) => (
            <div key={date} className="flex flex-col gap-0.5 border-l border-line p-1">
              {allDay.map((occ) => (
                <Link
                  key={occ.id}
                  href={`/h/${slug}/app/events/${occ.id}`}
                  className={`truncate rounded border-l-2 bg-accentsoft/60 px-1 py-0.5 text-[11px] hover:bg-accentsoft ${
                    !occ.active ? "opacity-50" : ""
                  }`}
                  style={{ borderLeftColor: occ.color }}
                  title={occ.title}
                >
                  {occ.title}
                </Link>
              ))}
              <Link
                href={`/h/${slug}/app/events/new?date=${date}`}
                className="text-center text-[10px] text-inkmuted/50 hover:text-accent"
                aria-label="Add event"
              >
                +
              </Link>
            </div>
          ))}
        </div>

        {/* Hourly timeline */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          <div style={{ height: `${24 * HOUR_PX}px` }} className="relative">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-inkmuted"
                style={{ top: `${h * HOUR_PX}px` }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>
          {days.map(({ date, blocks }) => (
            <div
              key={date}
              className="relative border-l border-line"
              style={{ height: `${24 * HOUR_PX}px` }}
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-line/60"
                  style={{ top: `${h * HOUR_PX}px` }}
                />
              ))}
              {blocks.map((b: Block) => (
                <Link
                  key={b.item.id}
                  href={`/h/${slug}/app/events/${b.item.id}`}
                  className={`absolute overflow-hidden rounded border-l-2 bg-accentsoft/80 px-1 py-0.5 text-[11px] leading-tight hover:bg-accentsoft ${
                    !b.item.active ? "opacity-50" : ""
                  }`}
                  style={{
                    top: `${b.topPercent}%`,
                    height: `${b.heightPercent}%`,
                    left: `calc(${(b.column / b.columns) * 100}% + 1px)`,
                    width: `calc(${(1 / b.columns) * 100}% - 2px)`,
                    borderLeftColor: b.item.color,
                  }}
                  title={b.item.title}
                >
                  {b.item.timeLabel && <span className="tnum block text-inkmuted">{b.item.timeLabel}</span>}
                  {b.item.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
