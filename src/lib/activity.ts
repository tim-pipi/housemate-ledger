import type { expenses, settlements } from "@/db/schema";

// Shared by activity/page.tsx's initial server render and the loadMoreActivity
// action's subsequent "Load more" fetches, so both slice the merged feed in
// the same increments.
export const ACTIVITY_PAGE_SIZE = 20;

type ExpenseRow = typeof expenses.$inferSelect;
type SettlementRow = typeof settlements.$inferSelect;

export type FeedItem =
  | { kind: "expense"; date: string; id: number; e: ExpenseRow }
  | { kind: "settlement"; date: string; id: number; s: SettlementRow };

export const FEED_SORTS = ["added", "date", "amountDesc", "amountAsc"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const FEED_TYPES = ["all", "expense", "settlement"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export type FeedQuery = {
  sort: FeedSort;
  type: FeedType;
  // Expenses match on payer, settlements on from/to.
  memberId: number | null;
  // Expenses only — a category filter hides settlements.
  category: string | null;
  // "YYYY-MM", matched against the item's own date.
  month: string | null;
};

// "Recently added" (created_at) is the default: a backdated expense should
// surface when it's entered, not sink to wherever its date puts it.
export const DEFAULT_FEED_QUERY: FeedQuery = {
  sort: "added",
  type: "all",
  memberId: null,
  category: null,
  month: null,
};

const amountOf = (i: FeedItem) => (i.kind === "expense" ? i.e.amountCents : i.s.amountCents);
const addedAt = (i: FeedItem) => (i.kind === "expense" ? i.e.createdAt : i.s.createdAt).getTime();

const byAdded = (a: FeedItem, b: FeedItem) => addedAt(b) - addedAt(a) || b.id - a.id;

const COMPARATORS: Record<FeedSort, (a: FeedItem, b: FeedItem) => number> = {
  added: byAdded,
  date: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id),
  amountDesc: (a, b) => amountOf(b) - amountOf(a) || byAdded(a, b),
  amountAsc: (a, b) => amountOf(a) - amountOf(b) || byAdded(a, b),
};

// Merges expenses + settlements into one feed. Shared by the dashboard (which
// only shows the most recent slice) and the full /activity page, so the
// merge/sort order never drifts between the two.
export function buildFeed(
  exp: ExpenseRow[],
  setl: SettlementRow[],
  sort: FeedSort = DEFAULT_FEED_QUERY.sort
): FeedItem[] {
  return [
    ...exp.map((e) => ({ kind: "expense" as const, date: e.date, id: e.id, e })),
    ...setl.map((s) => ({ kind: "settlement" as const, date: s.date, id: s.id, s })),
  ].sort(COMPARATORS[sort]);
}

// Filters (AND) and re-sorts an already-merged feed.
export function applyFeedQuery(items: FeedItem[], query: FeedQuery): FeedItem[] {
  return items
    .filter((i) => {
      if (query.type !== "all" && i.kind !== query.type) return false;
      if (query.month && !i.date.startsWith(query.month)) return false;
      if (query.category && (i.kind !== "expense" || i.e.category !== query.category)) return false;
      if (query.memberId !== null) {
        const involved =
          i.kind === "expense"
            ? i.e.payerMemberId === query.memberId
            : i.s.fromMemberId === query.memberId || i.s.toMemberId === query.memberId;
        if (!involved) return false;
      }
      return true;
    })
    .sort(COMPARATORS[query.sort]);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SGT_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Singapore",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "19 Sep, 14:32" in Singapore time (Invariant 8). Built from numeric parts
// rather than toLocaleString so server and browser render identical text —
// month-name spelling varies between ICU builds and would break hydration.
export function fmtAdded(d: Date): string {
  const p = Object.fromEntries(SGT_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
}

// Server actions receive arbitrary client input; coerce it to a valid query
// rather than trusting it. Bad fields fall back to the default, never throw.
export function parseFeedQuery(raw: unknown): FeedQuery {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_FEED_QUERY };
  const r = raw as Record<string, unknown>;
  return {
    sort: FEED_SORTS.find((s) => s === r.sort) ?? DEFAULT_FEED_QUERY.sort,
    type: FEED_TYPES.find((t) => t === r.type) ?? DEFAULT_FEED_QUERY.type,
    memberId:
      typeof r.memberId === "number" && Number.isInteger(r.memberId) && r.memberId > 0
        ? r.memberId
        : null,
    category: typeof r.category === "string" && r.category !== "" ? r.category : null,
    month: typeof r.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.month) ? r.month : null,
  };
}
