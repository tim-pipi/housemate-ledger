"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CATEGORIES } from "@/lib/constants";
import {
  DEFAULT_FEED_QUERY,
  type FeedItem,
  type FeedQuery,
  type FeedSort,
  type FeedType,
} from "@/lib/activity";
import { loadMoreActivity } from "./actions";

const SORT_LABELS: Record<FeedSort, string> = {
  added: "Recently added",
  date: "Expense date",
  amountDesc: "Amount: high to low",
  amountAsc: "Amount: low to high",
};

const TYPE_LABELS: Record<FeedType, string> = {
  all: "All",
  expense: "Expenses",
  settlement: "Settlements",
};

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${name} ${y}`;
}

export function ActivityFeedList({
  slug,
  initialItems,
  initialHasMore,
  byId,
  months,
}: {
  slug: string;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  byId: Record<number, { username: string }>;
  months: string[];
}) {
  const [query, setQuery] = useState<FeedQuery>(DEFAULT_FEED_QUERY);
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Bumped on every query change so a slow response for an old query can't
  // overwrite (or append to) the list for the current one.
  const requestId = useRef(0);

  const byIdMap = useMemo(
    () => new Map(Object.entries(byId).map(([id, m]) => [Number(id), m])),
    [byId]
  );

  const filtersActive =
    query.type !== "all" || query.memberId !== null || query.category !== null || query.month !== null;

  const changeQuery = (patch: Partial<FeedQuery>) => {
    const next = { ...query, ...patch };
    // Settlements have no category, so a settlements-only view can't have one.
    if (next.type === "settlement") next.category = null;
    setQuery(next);
    setError(null);
    const id = ++requestId.current;
    startTransition(async () => {
      try {
        const { items: first, hasMore: more } = await loadMoreActivity(slug, 0, next);
        if (id !== requestId.current) return;
        setItems(first);
        setHasMore(more);
      } catch {
        if (id === requestId.current) setError("Couldn't update the list. Try again.");
      }
    });
  };

  const loadMore = () => {
    setError(null);
    const id = requestId.current;
    startTransition(async () => {
      try {
        const { items: next, hasMore: more } = await loadMoreActivity(slug, items.length, query);
        if (id !== requestId.current) return;
        setItems((prev) => [...prev, ...next]);
        setHasMore(more);
      } catch {
        if (id === requestId.current) setError("Couldn't load more. Try again.");
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-inkmuted">Sort by</span>
          <select
            className="w-full"
            value={query.sort}
            onChange={(e) => changeQuery({ sort: e.target.value as FeedSort })}
          >
            {(Object.keys(SORT_LABELS) as FeedSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-inkmuted">Show</span>
          <select
            className="w-full"
            value={query.type}
            onChange={(e) => changeQuery({ type: e.target.value as FeedType })}
          >
            {(Object.keys(TYPE_LABELS) as FeedType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-inkmuted">Person</span>
          <select
            className="w-full"
            value={query.memberId ?? ""}
            onChange={(e) => changeQuery({ memberId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Everyone</option>
            {Object.entries(byId).map(([id, m]) => (
              <option key={id} value={id}>
                {m.username}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-inkmuted">Category</span>
          <select
            className="w-full disabled:opacity-60"
            value={query.category ?? ""}
            disabled={query.type === "settlement"}
            onChange={(e) => changeQuery({ category: e.target.value || null })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-inkmuted">Month</span>
          <select
            className="w-full"
            value={query.month ?? ""}
            onChange={(e) => changeQuery({ month: e.target.value || null })}
          >
            <option value="">All time</option>
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {fmtMonth(ym)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtersActive && (
        <button
          type="button"
          onClick={() => changeQuery({ ...DEFAULT_FEED_QUERY, sort: query.sort })}
          className="mt-2 text-xs text-accent underline"
        >
          Clear filters
        </button>
      )}

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <ActivityFeed
          slug={slug}
          feed={items}
          byId={byIdMap}
          emptyMessage={filtersActive ? "Nothing matches these filters." : "No activity yet."}
        />
      </div>
      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
      {hasMore && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="btn-ghost px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
