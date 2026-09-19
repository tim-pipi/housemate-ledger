import { cache } from "react";
import Link from "next/link";
import { db } from "@/db";
import { expenses, expenseShares, settlements, houseEvents } from "@/db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import { computeNet, simplify } from "@/lib/balances";
import { fmtSGD } from "@/lib/constants";
import { formatEventDate, formatEventTime } from "@/lib/events";
import { sgToday } from "@/lib/recurring";
import { buildFeed } from "@/lib/activity";
import { SubmitButton } from "@/components/SubmitButton";
import { ActivityFeed } from "@/components/ActivityFeed";
import { quickSettle } from "./actions";

// Async server components the dashboard streams in behind <Suspense>
// boundaries. Callers must already have run requireMember() — these trust the
// houseId/members they're handed and only ever query by that houseId.

type Member = { id: number; username: string; color: string; active: number };

const DASHBOARD_FEED_LIMIT = 8;

// Balances and Activity both need the full ledger; cache() dedupes it to a
// single fetch per request even though the two sections render independently.
// Shares are selected via a subquery on house expenses so all three queries
// run in parallel instead of waiting on the expense ids first.
const loadLedger = cache(async (houseId: number) => {
  const [exp, setl, shares] = await Promise.all([
    db().query.expenses.findMany({
      where: eq(expenses.houseId, houseId),
      orderBy: [desc(expenses.date), desc(expenses.id)],
    }),
    db().query.settlements.findMany({
      where: eq(settlements.houseId, houseId),
      orderBy: [desc(settlements.date), desc(settlements.id)],
    }),
    db().query.expenseShares.findMany({
      where: inArray(
        expenseShares.expenseId,
        db().select({ id: expenses.id }).from(expenses).where(eq(expenses.houseId, houseId))
      ),
    }),
  ]);
  return { exp, setl, shares };
});

export async function BalancesSection({
  slug,
  houseId,
  meId,
  houseMembers,
}: {
  slug: string;
  houseId: number;
  meId: number;
  houseMembers: Member[];
}) {
  const { exp, setl, shares } = await loadLedger(houseId);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));

  const sharesByExpense = new Map<number, { memberId: number; shareCents: number }[]>();
  for (const s of shares) {
    const list = sharesByExpense.get(s.expenseId) ?? [];
    list.push({ memberId: s.memberId, shareCents: s.shareCents });
    sharesByExpense.set(s.expenseId, list);
  }

  const net = computeNet(
    exp.map((e) => ({ payerMemberId: e.payerMemberId, shares: sharesByExpense.get(e.id) ?? [] })),
    setl
  );
  const transfers = simplify(net);

  const monthSpend = exp
    .filter((e) => e.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((a, e) => a + e.amountCents, 0);

  return (
    <>
      {/* Balances receipt */}
      <section className="mt-6 rounded-xl bg-white shadow-card">
        <div className="flex items-baseline justify-between px-5 pt-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
            Balances
          </h2>
          <p className="tnum text-xs text-inkmuted">
            {fmtSGD(monthSpend)} spent this month
          </p>
        </div>
        <ul className="mt-2 divide-y divide-line px-5">
          {houseMembers
            .filter((m) => m.active || (net[m.id] ?? 0) !== 0)
            .map((m) => {
              const v = net[m.id] ?? 0;
              return (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: m.color, opacity: m.active ? 1 : 0.5 }}
                    />
                    <span style={{ opacity: m.active ? 1 : 0.6 }}>{m.username}</span>
                    {m.id === meId && <span className="text-xs text-inkmuted">(you)</span>}
                    {!m.active && (
                      <span className="rounded bg-line px-1.5 py-0.5 text-xs text-inkmuted">
                        inactive
                      </span>
                    )}
                  </span>
                  <span
                    className={`tnum font-display font-semibold ${
                      v > 0 ? "text-accentdark" : v < 0 ? "text-danger" : "text-inkmuted"
                    }`}
                  >
                    {v > 0 ? "+" : ""}
                    {fmtSGD(v)}
                  </span>
                </li>
              );
            })}
        </ul>
        <div className="receipt-edge h-3 w-full bg-white" />
      </section>

      {/* Suggested settlements */}
      {transfers.length > 0 && (
        <section className="mt-4 rounded-xl border border-line bg-accentsoft/50 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
            Settle up
          </h2>
          <ul className="mt-2 space-y-2">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  <strong>{byId.get(t.from)?.username}</strong> pays{" "}
                  <strong>{byId.get(t.to)?.username}</strong>{" "}
                  <span className="tnum font-display font-semibold">{fmtSGD(t.amountCents)}</span>
                </span>
                <form action={quickSettle}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="from" value={t.from} />
                  <input type="hidden" name="to" value={t.to} />
                  <input type="hidden" name="amountCents" value={t.amountCents} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingLabel="Marking…">
                    Mark paid
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-inkmuted">
            Transfer the money outside the app (e.g. PayNow), then mark it paid here.
          </p>
        </section>
      )}
    </>
  );
}

export async function UpcomingSection({ slug, houseId }: { slug: string; houseId: number }) {
  const { ym, day } = sgToday();
  const today = `${ym}-${String(day).padStart(2, "0")}`;
  const upcomingEvents = await db().query.houseEvents.findMany({
    where: and(eq(houseEvents.houseId, houseId), eq(houseEvents.active, 1), gte(houseEvents.nextDate, today)),
    orderBy: (t, { asc }) => [asc(t.nextDate)],
    limit: 3,
  });
  if (upcomingEvents.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
          Upcoming
        </h2>
        <Link
          href={`/h/${slug}/app/events`}
          className="text-xs text-accent underline-offset-2 hover:underline"
        >
          Calendar →
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {upcomingEvents.map((e) => (
          <li key={e.id} className="flex items-center justify-between text-sm">
            <span>{e.title}</span>
            <span className="tnum text-inkmuted">
              {formatEventDate(e.nextDate)}
              {formatEventTime(e.startTime, e.endTime) && ` · ${formatEventTime(e.startTime, e.endTime)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function ActivitySection({
  slug,
  houseId,
  houseMembers,
}: {
  slug: string;
  houseId: number;
  houseMembers: Member[];
}) {
  const { exp, setl } = await loadLedger(houseId);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));
  const feed = buildFeed(exp, setl);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
          Activity
        </h2>
        {feed.length > DASHBOARD_FEED_LIMIT && (
          <Link
            href={`/h/${slug}/app/activity`}
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            See all →
          </Link>
        )}
      </div>
      <ActivityFeed slug={slug} feed={feed.slice(0, DASHBOARD_FEED_LIMIT)} byId={byId} />
    </section>
  );
}
