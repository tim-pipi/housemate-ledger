import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/guard";
import { MemberForm } from "../member-form";

export const dynamic = "force-dynamic";

export default async function EditMember({
  params,
}: {
  params: { slug: string; memberId: string };
}) {
  const { me, houseMembers } = await requireMember(params.slug);
  const target = houseMembers.find((m) => m.id === Number(params.memberId));
  if (!target) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link
        href={`/h/${params.slug}/app/members`}
        className="text-sm text-inkmuted hover:underline"
      >
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Edit member</h1>
      {target.id === me.id && (
        <p className="mt-1 text-xs text-inkmuted">Editing your own profile.</p>
      )}
      <MemberForm slug={params.slug} member={target} />
    </main>
  );
}
