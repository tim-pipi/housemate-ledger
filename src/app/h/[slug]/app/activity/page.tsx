import { Suspense } from "react";
import { requireMember } from "@/lib/guard";
import { ACTIVITY_PAGE_SIZE, DEFAULT_FEED_QUERY } from "@/lib/activity";
import { fetchFeed } from "@/lib/activity-data";
import { PageHeader } from "@/components/PageHeader";
import { ActivityFeedSkeleton } from "@/components/Skeleton";
import { ActivityFeedList } from "./activity-feed-list";

export const dynamic = "force-dynamic";

export default async function Activity({ params }: { params: { slug: string } }) {
  const { house, houseMembers } = await requireMember(params.slug);
  const byId = Object.fromEntries(houseMembers.map((m) => [m.id, { username: m.username }]));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader
        backHref={`/h/${params.slug}/app`}
        title="Activity"
        description="Full history of expenses and settlements."
      />
      <div className="mt-4">
        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedSection slug={params.slug} houseId={house.id} byId={byId} />
        </Suspense>
      </div>
    </main>
  );
}

async function ActivityFeedSection({
  slug,
  houseId,
  byId,
}: {
  slug: string;
  houseId: number;
  byId: Record<number, { username: string }>;
}) {
  const feed = await fetchFeed(houseId, DEFAULT_FEED_QUERY);
  const initialItems = feed.slice(0, ACTIVITY_PAGE_SIZE);
  const initialHasMore = feed.length > ACTIVITY_PAGE_SIZE;
  // Month filter options come from the unfiltered history, newest first.
  const months = Array.from(new Set(feed.map((i) => i.date.slice(0, 7)))).sort().reverse();

  return (
    <ActivityFeedList
      slug={slug}
      initialItems={initialItems}
      initialHasMore={initialHasMore}
      byId={byId}
      months={months}
    />
  );
}
