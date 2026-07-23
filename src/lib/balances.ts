// Net balance per member and simplified pairwise transfers.
// Positive net = others owe this member.

export type Transfer = { from: number; to: number; amountCents: number };

export function computeNet(
  expenses: { payerMemberId: number; shares: { memberId: number; shareCents: number }[] }[],
  settlements: { fromMemberId: number; toMemberId: number; amountCents: number }[]
): Record<number, number> {
  const net: Record<number, number> = {};
  const add = (id: number, v: number) => (net[id] = (net[id] ?? 0) + v);
  for (const e of expenses) {
    for (const s of e.shares) {
      add(e.payerMemberId, s.shareCents);
      add(s.memberId, -s.shareCents);
    }
  }
  for (const s of settlements) {
    add(s.fromMemberId, s.amountCents);
    add(s.toMemberId, -s.amountCents);
  }
  return net;
}

// Greedy simplification: repeatedly match the largest debtor with the largest creditor.
export function simplify(net: Record<number, number>): Transfer[] {
  const creditors = Object.entries(net)
    .map(([id, v]) => ({ id: Number(id), v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const debtors = Object.entries(net)
    .map(([id, v]) => ({ id: Number(id), v: -v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const transfers: Transfer[] = [];
  let ci = 0,
    di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].v, debtors[di].v);
    if (pay > 0)
      transfers.push({ from: debtors[di].id, to: creditors[ci].id, amountCents: pay });
    creditors[ci].v -= pay;
    debtors[di].v -= pay;
    if (creditors[ci].v === 0) ci++;
    if (debtors[di].v === 0) di++;
  }
  return transfers;
}
