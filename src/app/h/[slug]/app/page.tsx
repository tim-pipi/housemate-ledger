import Link from "next/link";
import { db } from "@/db";
import { expenses, expenseShares, settlements, shoppingItems, houseEvents } from "@/db/schema";
import { and, eq, desc, inArray, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { computeNet, simplify } from "@/lib/balances";
import { fmtSGD } from "@/lib/constants";
import { formatEventDate } from "@/lib/events";
import { logout } from "../actions";
import { quickSettle } from "./actions";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: { slug: string } }) {
  const { house, me, houseMembers } = await requireMember(params.slug);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));

  const exp = await db().query.expenses.findMany({
    where: eq(expenses.houseId, house.id),
    orderBy: [desc(expenses.date), desc(expenses.id)],
  });
  const shares = exp.length
    ? await db().query.expenseShares.findMany({
        where: inArray(expenseShares.expenseId, exp.map((e) => e.id)),
      })
    : [];
  const sharesByExpense = new Map<number, { memberId: number; shareCents: number }[]>();
  for (const s of shares) {
    const list = sharesByExpense.get(s.expenseId) ?? [];
    list.push({ memberId: s.memberId, shareCents: s.shareCents });
    sharesByExpense.set(s.expenseId, list);
  }
  const setl = await db().query.settlements.findMany({
    where: eq(settlements.houseId, house.id),
    orderBy: [desc(settlements.date), desc(settlements.id)],
  });

  const openShoppingItems = await db().query.shoppingItems.findMany({
    where: and(
      eq(shoppingItems.houseId, house.id),
      isNull(shoppingItems.boughtAt),
      isNull(shoppingItems.archivedAt)
    ),
    columns: { id: true },
  });

  const upcomingEvents = await db().query.houseEvents.findMany({
    where: and(eq(houseEvents.houseId, house.id), eq(houseEvents.active, 1)),
    orderBy: (t, { asc }) => [asc(t.nextDate)],
    limit: 3,
  });

  const net = computeNet(
    exp.map((e) => ({ payerMemberId: e.payerMemberId, shares: sharesByExpense.get(e.id) ?? [] })),
    setl
  );
  const transfers = simplify(net);

  const feed = [
    ...exp.map((e) => ({ kind: "expense" as const, date: e.date, id: e.id, e })),
    ...setl.map((s) => ({ kind: "settlement" as const, date: s.date, id: s.id, s })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .slice(0, 25);

  const monthSpend = exp
    .filter((e) => e.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((a, e) => a + e.amountCents, 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
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
            <button className="text-sm text-inkmuted underline-offset-2 hover:underline">
              Log out
            </button>
          </form>
        </div>
      </header>

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
                    {m.id === me.id && <span className="text-xs text-inkmuted">(you)</span>}
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
                  <input type="hidden" name="slug" value={params.slug} />
                  <input type="hidden" name="from" value={t.from} />
                  <input type="hidden" name="to" value={t.to} />
                  <input type="hidden" name="amountCents" value={t.amountCents} />
                  <button className="btn-ghost px-3 py-1 text-sm">Mark paid</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-inkmuted">
            Transfer the money outside the app (e.g. PayNow), then mark it paid here.
          </p>
        </section>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <section className="mt-4 rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
              Upcoming
            </h2>
            <Link
              href={`/h/${params.slug}/app/events`}
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              Calendar →
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {upcomingEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span>{e.title}</span>
                <span className="tnum text-inkmuted">{formatEventDate(e.nextDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Activity */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
            Activity
          </h2>
          <div className="flex items-center gap-4">
            <Link
              href={`/h/${params.slug}/app/members`}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Members →
            </Link>
            <Link
              href={`/h/${params.slug}/app/shopping`}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Shopping{openShoppingItems.length > 0 ? ` (${openShoppingItems.length})` : ""} →
            </Link>
            <Link
              href={`/h/${params.slug}/app/recurring`}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Recurring bills →
            </Link>
            <Link
              href={`/h/${params.slug}/app/events`}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Calendar →
            </Link>
            <Link
              href={`/h/${params.slug}/app/telegram`}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Telegram →
            </Link>
          </div>
        </div>
        {feed.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
            No expenses yet. Add the first one to start the ledger.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {feed.map((item) =>
              item.kind === "expense" ? (
                <li key={`e${item.id}`}>
                  <Link
                    href={`/h/${params.slug}/app/expenses/${item.id}`}
                    className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-card transition-colors hover:bg-accentsoft/40"
                  >
                    <span>
                      <span className="block font-medium">{item.e.description}</span>
                      <span className="block text-xs text-inkmuted">
                        {item.e.category} · {item.e.date} · paid by{" "}
                        {byId.get(item.e.payerMemberId)?.username}
                      </span>
                    </span>
                    <span className="tnum font-display font-semibold">
                      {fmtSGD(item.e.amountCents)}
                    </span>
                  </Link>
                </li>
              ) : (
                <li
                  key={`s${item.id}`}
                  className="flex items-center justify-between rounded-xl border border-line p-3.5"
                >
                  <span>
                    <span className="block text-sm">
                      {byId.get(item.s.fromMemberId)?.username} settled{" "}
                      {byId.get(item.s.toMemberId)?.username}
                    </span>
                    <span className="block text-xs text-inkmuted">
                      {item.s.date}
                      {item.s.note ? ` · ${item.s.note}` : ""}
                    </span>
                  </span>
                  <span className="tnum font-display font-semibold text-inkmuted">
                    {fmtSGD(item.s.amountCents)}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {/* Add expense FAB */}
      <Link
        href={`/h/${params.slug}/app/expenses/new`}
        className="fixed bottom-6 right-6 rounded-full bg-accent px-5 py-3 font-display font-semibold text-white shadow-card transition-colors hover:bg-accentdark"
      >
        + Add expense
      </Link>
    </main>
  );
}
