import { Suspense } from "react";
import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { SubmitButton } from "@/components/SubmitButton";
import { BalancesSkeleton, DashboardActivitySkeleton } from "@/components/Skeleton";
import { logout } from "../actions";
import { ActivitySection, BalancesSection, UpcomingSection } from "./dashboard-sections";

export const dynamic = "force-dynamic";

// The header renders as soon as the auth guard resolves; each data section
// streams in behind its own <Suspense> boundary (see dashboard-sections.tsx).
export default async function Dashboard({ params }: { params: { slug: string } }) {
  const { house, me, houseMembers } = await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-36 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Housemate Ledger
          </p>
          <h1 className="font-display text-2xl font-bold">{house.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: me.color }}
            title={me.username}
          >
            {me.username.slice(0, 1).toUpperCase()}
          </span>
          <form action={logout}>
            <input type="hidden" name="slug" value={params.slug} />
            <SubmitButton
              className="text-sm text-inkmuted underline-offset-2 hover:underline"
              pendingLabel="Logging out…"
            >
              Log out
            </SubmitButton>
          </form>
        </div>
      </header>

      <Suspense fallback={<BalancesSkeleton />}>
        <BalancesSection slug={params.slug} houseId={house.id} meId={me.id} houseMembers={houseMembers} />
      </Suspense>

      {/* No skeleton: the section only renders when events exist, so a
          placeholder would often flash and then vanish. */}
      <Suspense fallback={null}>
        <UpcomingSection slug={params.slug} houseId={house.id} />
      </Suspense>

      <Suspense fallback={<DashboardActivitySkeleton />}>
        <ActivitySection slug={params.slug} houseId={house.id} houseMembers={houseMembers} />
      </Suspense>

      {/* Add expense FAB — bottom-20 clears the 64px bottom nav bar (h-16) with a margin */}
      <Link
        href={`/h/${params.slug}/app/expenses/new`}
        className="fixed bottom-20 right-6 rounded-full bg-accent px-5 py-3 font-display font-semibold text-white shadow-card transition-colors hover:bg-accentdark"
      >
        + Add expense
      </Link>
    </main>
  );
}
