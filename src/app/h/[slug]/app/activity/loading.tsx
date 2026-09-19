import { ActivityFeedSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/Skeleton";

export default function ActivityLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Activity" />
      <p className="mt-1 text-sm text-inkmuted">Full history of expenses and settlements.</p>
      <div className="mt-4">
        <ActivityFeedSkeleton />
      </div>
    </SkeletonPage>
  );
}
