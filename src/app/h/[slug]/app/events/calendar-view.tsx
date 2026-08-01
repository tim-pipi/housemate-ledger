"use client";

import { useState, useTransition } from "react";
import { addDays, parseDate, fmtDate } from "@/lib/date-strings";
import { getCalendarData } from "./actions";
import type { CalendarData, CalendarViewMode } from "./calendar-data";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";

const VIEW_OPTIONS: { key: CalendarViewMode; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
];

function shiftMonth(anchorDate: string, delta: number): string {
  const { y, m } = parseDate(anchorDate);
  let ny = y,
    nm = m + delta;
  if (nm < 1) {
    nm = 12;
    ny--;
  } else if (nm > 12) {
    nm = 1;
    ny++;
  }
  return fmtDate(ny, nm, 1);
}

function monthTitle(anchorDate: string): string {
  const { y, m } = parseDate(anchorDate);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(dt);
}

function weekTitle(gridDates: string[]): string {
  const label = (s: string) => {
    const { y, m, d } = parseDate(s);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(dt);
  };
  return `${label(gridDates[0])} – ${label(gridDates[gridDates.length - 1])}`;
}

export function CalendarView({ slug, initialData }: { slug: string; initialData: CalendarData }) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function reload(view: CalendarViewMode, anchorDate: string) {
    startTransition(async () => {
      const next = await getCalendarData(slug, view, anchorDate);
      setData(next);
    });
  }

  function goPrev() {
    const anchor = data.view === "week" ? addDays(data.anchorDate, -7) : shiftMonth(data.anchorDate, -1);
    reload(data.view, anchor);
  }
  function goNext() {
    const anchor = data.view === "week" ? addDays(data.anchorDate, 7) : shiftMonth(data.anchorDate, 1);
    reload(data.view, anchor);
  }
  function goToday() {
    reload(data.view, data.todayDate);
  }

  const title = data.view === "month" ? monthTitle(data.anchorDate) : weekTitle(data.gridDates);

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} className="btn-ghost px-2.5 py-1 text-sm" aria-label="Previous">
            ←
          </button>
          <button type="button" onClick={goToday} className="btn-ghost px-3 py-1 text-sm">
            Today
          </button>
          <button type="button" onClick={goNext} className="btn-ghost px-2.5 py-1 text-sm" aria-label="Next">
            →
          </button>
          <span className="font-display text-lg font-semibold">{title}</span>
        </div>
        <div className="flex gap-1.5">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => reload(v.key, data.anchorDate)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                data.view === v.key
                  ? "border-accent bg-accentsoft text-accentdark"
                  : "border-line bg-white hover:border-accent"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {data.view === "month" ? <MonthGrid slug={slug} data={data} /> : <WeekGrid slug={slug} data={data} />}
      </div>
    </div>
  );
}
