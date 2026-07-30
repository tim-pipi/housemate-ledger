import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { houseEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { EventForm } from "../event-form";
import type { Recurrence } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EditEvent({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const { house } = await requireMember(params.slug);
  const e = await db().query.houseEvents.findFirst({
    where: and(eq(houseEvents.id, Number(params.id)), eq(houseEvents.houseId, house.id)),
  });
  if (!e) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app/events`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Edit event</h1>
      <EventForm
        slug={params.slug}
        initial={{
          eventId: e.id,
          title: e.title,
          note: e.note ?? "",
          nextDate: e.nextDate,
          remindDaysBefore: e.remindDaysBefore,
          active: e.active === 1,
          recurrence: e.recurrence as Recurrence,
        }}
      />
    </main>
  );
}
