"use server";

import { db } from "@/db";
import { expenses, settlements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { buildFeed, ACTIVITY_PAGE_SIZE, type FeedItem } from "@/lib/activity";

// Re-fetches the full house history and re-derives the merged feed on every
// call rather than a DB-level cursor — same "fetch everything, derive in
// memory" approach the rest of the app uses for balances (Invariant 4).
// Cheap at household scale, and avoids cursor logic across two unioned
// tables ordered by (date, id) desc.
export async function loadMoreActivity(
  slug: string,
  offset: number
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const { house } = await requireMember(slug);
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

  const [exp, setl] = await Promise.all([
    db().query.expenses.findMany({
      where: eq(expenses.houseId, house.id),
      orderBy: [desc(expenses.date), desc(expenses.id)],
    }),
    db().query.settlements.findMany({
      where: eq(settlements.houseId, house.id),
      orderBy: [desc(settlements.date), desc(settlements.id)],
    }),
  ]);

  const feed = buildFeed(exp, setl);
  const items = feed.slice(safeOffset, safeOffset + ACTIVITY_PAGE_SIZE);
  const hasMore = safeOffset + ACTIVITY_PAGE_SIZE < feed.length;
  return { items, hasMore };
}
