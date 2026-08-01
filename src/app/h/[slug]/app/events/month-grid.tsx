import Link from "next/link";
import type { CalendarData } from "./calendar-data";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE = 3;

export function MonthGrid({ slug, data }: { slug: string; data: CalendarData }) {
  const anchorMonth = Number(data.anchorDate.split("-")[1]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] rounded-xl border-l border-t border-line bg-white shadow-card">
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-inkmuted">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="border-r border-line py-1.5">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {data.gridDates.map((date) => {
            const [, month, day] = date.split("-").map(Number);
            const inMonth = month === anchorMonth;
            const isToday = date === data.todayDate;
            const occurrences = data.occurrencesByDate[date] ?? [];
            const visible = occurrences.slice(0, MAX_VISIBLE);
            const overflow = occurrences.length - visible.length;

            return (
              <div
                key={date}
                className={`flex min-h-[96px] flex-col gap-1 border-b border-r border-line p-1.5 text-xs ${
                  inMonth ? "bg-white" : "bg-paper/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`tnum inline-flex h-5 w-5 items-center justify-center rounded-full ${
                      isToday ? "bg-accent font-semibold text-white" : inMonth ? "text-ink" : "text-inkmuted/50"
                    }`}
                  >
                    {day}
                  </span>
                  <Link
                    href={`/h/${slug}/app/events/new?date=${date}`}
                    className="px-1 text-inkmuted/50 hover:text-accent"
                    aria-label="Add event"
                  >
                    +
                  </Link>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {visible.map((occ) => (
                    <Link
                      key={occ.id}
                      href={`/h/${slug}/app/events/${occ.id}`}
                      className={`truncate rounded border-l-2 bg-accentsoft/60 px-1 py-0.5 hover:bg-accentsoft ${
                        !occ.active ? "opacity-50" : ""
                      }`}
                      style={{ borderLeftColor: occ.color }}
                      title={occ.title}
                    >
                      {occ.timeLabel && <span className="tnum text-inkmuted">{occ.timeLabel} </span>}
                      {occ.title}
                    </Link>
                  ))}
                  {overflow > 0 && <span className="px-1 text-[10px] text-inkmuted">+{overflow} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
