import { CardListSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/Skeleton";

export default function RecurringLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Recurring bills" withAction />
      <p className="mt-1 text-sm text-inkmuted">
        Templates post automatically as an expense on their day each month (just after midnight SGT). Edit the
        posted expense afterwards if the actual bill differs.
      </p>
      <CardListSkeleton className="mt-4" rows={3} />
    </SkeletonPage>
  );
}
