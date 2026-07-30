import Link from "next/link";
import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { formatEventDate, describeRecurrence, type Recurrence } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function Events({ params }: { params: { slug: string } }) {
  const { house } = await requireMember(params.slug);
  const events = await db().query.houseEvents.findMany({
    where: eq(houseEvents.houseId, house.id),
    orderBy: (t, { asc }) => [asc(t.nextDate), asc(t.id)],
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app`} className="text-sm text-inkmuted hover:underline">
        ← Back to dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Calendar</h1>
        <Link href={`/h/${params.slug}/app/events/new`} className="btn-primary text-sm">
          + New event
        </Link>
      </div>
      <p className="mt-1 text-sm text-inkmuted">
        Reminders for things that happen in the real world — paying the
        landlord, booking servicing, house dinners. Separate from the ledger's
        auto-posted recurring bills.
      </p>

      {events.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
          No events yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-xl bg-white p-4 shadow-card">
              <Link
                href={`/h/${params.slug}/app/events/${e.id}`}
                className="flex items-center justify-between gap-3 hover:text-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {e.title}
                    {!e.active && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-xs text-inkmuted">
                        paused
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-inkmuted">
                    {formatEventDate(e.nextDate)} · {describeRecurrence(e.recurrence as Recurrence)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
