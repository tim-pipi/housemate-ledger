import { PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/Skeleton";

export default function MoreLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="More" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-xl" />
        ))}
      </div>
    </SkeletonPage>
  );
}
