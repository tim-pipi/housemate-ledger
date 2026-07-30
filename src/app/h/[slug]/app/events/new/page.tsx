import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default async function NewEvent({ params }: { params: { slug: string } }) {
  await requireMember(params.slug);
  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app/events`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">New event</h1>
      <EventForm slug={params.slug} />
    </main>
  );
}
