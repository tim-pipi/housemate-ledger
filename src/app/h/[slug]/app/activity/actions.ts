"use server";

import { requireMember } from "@/lib/guard";
import { ACTIVITY_PAGE_SIZE, parseFeedQuery, type FeedItem } from "@/lib/activity";
import { fetchFeed } from "@/lib/activity-data";

// Serves both "Load more" (offset = items already shown) and a sort/filter
// change (offset 0, results replace the list). `rawQuery` comes straight from
// the client, so it's coerced through parseFeedQuery rather than trusted.
export async function loadMoreActivity(
  slug: string,
  offset: number,
  rawQuery?: unknown
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const { house } = await requireMember(slug);
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

  const feed = await fetchFeed(house.id, parseFeedQuery(rawQuery));
  const items = feed.slice(safeOffset, safeOffset + ACTIVITY_PAGE_SIZE);
  const hasMore = safeOffset + ACTIVITY_PAGE_SIZE < feed.length;
  return { items, hasMore };
}
