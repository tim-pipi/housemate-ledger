import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { sgToday } from "@/lib/recurring";
import { fmtDate } from "@/lib/date-strings";
import { PageHeader } from "@/components/PageHeader";
import { buildCalendarData, type CalendarViewMode } from "./calendar-data";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

function todayStr(): string {
  const { year, month, day } = sgToday();
  return fmtDate(year, month, day);
}

export default async function Events({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { view?: string; date?: string };
}) {
  const { house } = await requireMember(params.slug);

  const view: CalendarViewMode = searchParams.view === "week" ? "week" : "month";
  const anchorDate =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : todayStr();

  const data = await buildCalendarData(house.id, view, anchorDate);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        backHref={`/h/${params.slug}/app`}
        title="Calendar"
        action={
          <Link href={`/h/${params.slug}/app/events/new`} className="btn-primary text-sm">
            + New event
          </Link>
        }
        description="Reminders for things that happen in the real world — paying the landlord, booking servicing, house dinners. Separate from the ledger's auto-posted recurring bills."
      />
      <div className="mt-4">
        <CalendarView slug={params.slug} initialData={data} />
      </div>
    </main>
  );
}
