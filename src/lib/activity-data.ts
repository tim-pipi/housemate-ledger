import { db } from "@/db";
import { expenses, settlements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyFeedQuery, buildFeed, type FeedItem, type FeedQuery } from "@/lib/activity";

// Fetches the house's full history and derives the merged, filtered, sorted
// feed in memory — same "fetch everything, derive in memory" approach as
// balances (Invariant 4). Cheap at household scale, and avoids cursor logic
// across two unioned tables with user-selectable sort/filters. Sorting happens
// in JS, so no DB orderBy is needed.
export async function fetchFeed(houseId: number, query: FeedQuery): Promise<FeedItem[]> {
  const [exp, setl] = await Promise.all([
    db().query.expenses.findMany({ where: eq(expenses.houseId, houseId) }),
    db().query.settlements.findMany({ where: eq(settlements.houseId, houseId) }),
  ]);
  return applyFeedQuery(buildFeed(exp, setl), query);
}
