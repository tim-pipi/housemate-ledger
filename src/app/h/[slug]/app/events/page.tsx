import Link from "next/link";
import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { formatEventDate, describeRecurrence, type Recurrence } from "@/lib/events";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function Events({ params }: { params: { slug: string } }) {
  const { house } = await requireMember(params.slug);
  const events = await db().query.houseEvents.findMany({
    where: eq(houseEvents.houseId, house.id),
    orderBy: (t, { asc }) => [asc(t.nextDate), asc(t.id)],
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
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

      {events.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
          No events yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((e) => (
            <Card as="li" key={e.id}>
              <Link
                href={`/h/${params.slug}/app/events/${e.id}`}
                className="flex items-center justify-between gap-3 hover:text-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {e.title}
                    {!e.active && <Badge>paused</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-inkmuted">
                    <span className="tnum font-medium text-ink/70">
                      {formatEventDate(e.nextDate)}
                    </span>
                    {" · "}
                    {describeRecurrence(e.recurrence as Recurrence)}
                  </span>
                  {e.note && (
                    <span className="mt-0.5 block truncate text-xs text-inkmuted/80">
                      {e.note}
                    </span>
                  )}
                </span>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
