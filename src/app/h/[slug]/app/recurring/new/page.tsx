import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { RecurringForm } from "../recurring-form";

export const dynamic = "force-dynamic";

export default async function NewTemplate({ params }: { params: { slug: string } }) {
  const { me, houseMembers } = await requireMember(params.slug);
  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app/recurring`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">New recurring bill</h1>
      <RecurringForm
        slug={params.slug}
        meId={me.id}
        members={houseMembers
          .filter((m) => m.active)
          .map((m) => ({ id: m.id, username: m.username, color: m.color }))}
      />
    </main>
  );
}
