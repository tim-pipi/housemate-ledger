"use client";

import { useMemo, useState, useTransition } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { FeedItem } from "@/lib/activity";
import { loadMoreActivity } from "./actions";

export function ActivityFeedList({
  slug,
  initialItems,
  initialHasMore,
  byId,
}: {
  slug: string;
  initialItems: FeedItem[];
  initialHasMore: boolean;
  byId: Record<number, { username: string }>;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byIdMap = useMemo(
    () => new Map(Object.entries(byId).map(([id, m]) => [Number(id), m])),
    [byId]
  );

  const loadMore = () => {
    setError(null);
    startTransition(async () => {
      try {
        const { items: next, hasMore: more } = await loadMoreActivity(slug, items.length);
        setItems((prev) => [...prev, ...next]);
        setHasMore(more);
      } catch {
        setError("Couldn't load more. Try again.");
      }
    });
  };

  return (
    <>
      <ActivityFeed slug={slug} feed={items} byId={byIdMap} emptyMessage="No activity yet." />
      {hasMore && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {error && <p className="text-sm text-danger">{error}</p>}
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
