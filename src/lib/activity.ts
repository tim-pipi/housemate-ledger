import type { expenses, settlements } from "@/db/schema";

type ExpenseRow = typeof expenses.$inferSelect;
type SettlementRow = typeof settlements.$inferSelect;

export type FeedItem =
  | { kind: "expense"; date: string; id: number; e: ExpenseRow }
  | { kind: "settlement"; date: string; id: number; s: SettlementRow };

// Merges expenses + settlements into one reverse-chronological feed. Shared
// by the dashboard (which only shows the most recent slice) and the full
// /activity page, so the merge/sort order never drifts between the two.
export function buildFeed(exp: ExpenseRow[], setl: SettlementRow[]): FeedItem[] {
  return [
    ...exp.map((e) => ({ kind: "expense" as const, date: e.date, id: e.id, e })),
    ...setl.map((s) => ({ kind: "settlement" as const, date: s.date, id: s.id, s })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}
