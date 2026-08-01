import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { SubmitButton } from "@/components/SubmitButton";
import { toggleMemberActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: { slug: string } }) {
  const { me, houseMembers } = await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Members</h1>

      <ul className="mt-6 space-y-2">
        {houseMembers.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: m.color, opacity: m.active ? 1 : 0.5 }}
              >
                {m.username.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-medium">
                  {m.username}
                  {m.id === me.id && (
                    <span className="ml-1.5 text-xs text-inkmuted">(you)</span>
                  )}
                </p>
                <p className="text-xs text-inkmuted">
                  {m.active ? "Active" : "Inactive"}
                  {m.passwordHash ? " · password set" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {m.id !== me.id && (
                <form action={toggleMemberActive}>
                  <input type="hidden" name="slug" value={params.slug} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <SubmitButton
                    className="btn-ghost px-3 py-1.5 text-sm"
                    pendingLabel={m.active ? "Deactivating…" : "Reactivating…"}
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </SubmitButton>
                </form>
              )}
              <Link
                href={`/h/${params.slug}/app/members/${m.id}`}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-inkmuted">
        Deactivated members are hidden from new expenses but their history and balances remain.
      </p>
    </main>
  );
}
