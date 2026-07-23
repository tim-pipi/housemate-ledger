// Split math. All amounts are integer cents. Every method resolves to exact
// per-member cents that sum to the total; leftover cents from rounding are
// assigned deterministically starting with the payer.

export type SplitMethod = "equal" | "exact" | "percent" | "shares" | "adjustment";

export type SplitConfig =
  | { method: "equal"; participants: number[] }
  | { method: "exact"; amounts: Record<string, number> } // memberId -> cents
  | { method: "percent"; percents: Record<string, number> } // memberId -> percent (2dp ok)
  | { method: "shares"; shares: Record<string, number> } // memberId -> share units
  | { method: "adjustment"; participants: number[]; adjustments: Record<string, number> }; // memberId -> +/- cents

export function resolveShares(
  totalCents: number,
  config: SplitConfig,
  payerId: number
): Record<number, number> {
  if (!Number.isInteger(totalCents) || totalCents <= 0)
    throw new Error("Amount must be a positive number.");

  switch (config.method) {
    case "equal":
      return divideProportionally(totalCents, evenWeights(config.participants), payerId);

    case "exact": {
      const entries = Object.entries(config.amounts).map(([id, c]) => [Number(id), c] as const);
      if (entries.length === 0) throw new Error("Select at least one person.");
      const sum = entries.reduce((a, [, c]) => a + c, 0);
      if (sum !== totalCents)
        throw new Error(
          `Exact amounts must add up to the total (${fmt(sum)} entered, ${fmt(totalCents)} needed).`
        );
      if (entries.some(([, c]) => c < 0)) throw new Error("Amounts can't be negative.");
      return Object.fromEntries(entries.filter(([, c]) => c > 0));
    }

    case "percent": {
      const entries = Object.entries(config.percents).map(([id, p]) => [Number(id), p] as const);
      if (entries.length === 0) throw new Error("Select at least one person.");
      const sum = entries.reduce((a, [, p]) => a + p, 0);
      if (Math.abs(sum - 100) > 0.001)
        throw new Error(`Percentages must add up to 100% (currently ${round2(sum)}%).`);
      if (entries.some(([, p]) => p < 0)) throw new Error("Percentages can't be negative.");
      const weights: Record<number, number> = Object.fromEntries(entries.filter(([, p]) => p > 0));
      return divideProportionally(totalCents, weights, payerId);
    }

    case "shares": {
      const entries = Object.entries(config.shares).map(([id, s]) => [Number(id), s] as const);
      const positive = entries.filter(([, s]) => s > 0);
      if (positive.length === 0) throw new Error("Assign at least one share.");
      if (entries.some(([, s]) => s < 0)) throw new Error("Shares can't be negative.");
      return divideProportionally(totalCents, Object.fromEntries(positive), payerId);
    }

    case "adjustment": {
      const parts = config.participants;
      if (parts.length === 0) throw new Error("Select at least one person.");
      const adjTotal = parts.reduce((a, id) => a + (config.adjustments[id] ?? 0), 0);
      const base = totalCents - adjTotal;
      if (base < 0)
        throw new Error("Adjustments exceed the total amount.");
      const baseShares = divideProportionally(base, evenWeights(parts), payerId);
      const out: Record<number, number> = {};
      for (const id of parts) {
        const v = (baseShares[id] ?? 0) + (config.adjustments[id] ?? 0);
        if (v < 0) throw new Error("An adjustment makes someone's share negative.");
        if (v > 0) out[id] = v;
      }
      return out;
    }
  }
}

function evenWeights(ids: number[]): Record<number, number> {
  if (ids.length === 0) throw new Error("Select at least one person.");
  return Object.fromEntries(ids.map((id) => [id, 1]));
}

// Largest-remainder division; leftover cents go to payer first, then lowest member id.
function divideProportionally(
  totalCents: number,
  weights: Record<number, number>,
  payerId: number
): Record<number, number> {
  const ids = Object.keys(weights).map(Number);
  const totalWeight = ids.reduce((a, id) => a + weights[id], 0);
  if (totalWeight <= 0) throw new Error("Invalid split.");
  const raw = ids.map((id) => ({ id, exact: (totalCents * weights[id]) / totalWeight }));
  const out: Record<number, number> = {};
  let assigned = 0;
  for (const r of raw) {
    const floor = Math.floor(r.exact);
    out[r.id] = floor;
    assigned += floor;
  }
  let leftover = totalCents - assigned;
  const order = raw
    .map((r) => ({ id: r.id, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac || (a.id === payerId ? -1 : b.id === payerId ? 1 : a.id - b.id));
  for (let i = 0; leftover > 0; i = (i + 1) % order.length) {
    out[order[i].id] += 1;
    leftover -= 1;
  }
  for (const id of ids) if (out[id] === 0) delete out[id];
  return out;
}

export function fmt(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
