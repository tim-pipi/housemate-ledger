import { db } from "@/db";
import { expenses, expenseShares, settlements, members } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { computeNet, simplify, type Transfer } from "@/lib/balances";
import { fmtSGD } from "@/lib/constants";
import { escapeHtml } from "@/lib/telegram";
import { sgToday } from "@/lib/recurring";

async function loadHouseData(houseId: number) {
  const houseMembers = await db().query.members.findMany({ where: eq(members.houseId, houseId) });
  const byId = new Map(houseMembers.map((m) => [m.id, m.username]));

  const exp = await db().query.expenses.findMany({ where: eq(expenses.houseId, houseId) });
  const shareRows = exp.length
    ? await db().query.expenseShares.findMany({
        where: inArray(expenseShares.expenseId, exp.map((e) => e.id)),
      })
    : [];
  const sharesByExpense = new Map<number, { memberId: number; shareCents: number }[]>();
  for (const s of shareRows) {
    const list = sharesByExpense.get(s.expenseId) ?? [];
    list.push({ memberId: s.memberId, shareCents: s.shareCents });
    sharesByExpense.set(s.expenseId, list);
  }

  const setl = await db().query.settlements.findMany({ where: eq(settlements.houseId, houseId) });

  return { exp, sharesByExpense, setl, byId };
}

function renderOutstanding(transfers: Transfer[], byId: Map<number, string>): string {
  if (transfers.length === 0) return "All square — nobody owes anybody.";
  return transfers
    .map(
      (t) =>
        `• ${escapeHtml(byId.get(t.from) ?? "?")} → ${escapeHtml(byId.get(t.to) ?? "?")} ${fmtSGD(t.amountCents)}`
    )
    .join("\n");
}

export async function buildBalancesMessage(houseId: number): Promise<string> {
  const { exp, sharesByExpense, setl, byId } = await loadHouseData(houseId);
  const net = computeNet(
    exp.map((e) => ({ payerMemberId: e.payerMemberId, shares: sharesByExpense.get(e.id) ?? [] })),
    setl
  );
  const transfers = simplify(net);
  return `<b>Balances</b>\n${renderOutstanding(transfers, byId)}`;
}

export async function buildDigestMessage(house: {
  id: number;
  name: string;
  slug: string;
}): Promise<string> {
  const { exp, sharesByExpense, setl, byId } = await loadHouseData(house.id);
  const { ym } = sgToday();
  const monthSpend = exp
    .filter((e) => e.date.slice(0, 7) === ym)
    .reduce((a, e) => a + e.amountCents, 0);
  const net = computeNet(
    exp.map((e) => ({ payerMemberId: e.payerMemberId, shares: sharesByExpense.get(e.id) ?? [] })),
    setl
  );
  const transfers = simplify(net);
  const appUrl = process.env.APP_URL;
  const link = appUrl ? `${appUrl}/h/${house.slug}/app` : `/h/${house.slug}/app`;

  return [
    `📒 <b>${escapeHtml(house.name)} — weekly digest</b>`,
    `This month so far: ${fmtSGD(monthSpend)}`,
    "",
    "Outstanding:",
    renderOutstanding(transfers, byId),
    "",
    `Settle up: ${link}`,
  ].join("\n");
}
