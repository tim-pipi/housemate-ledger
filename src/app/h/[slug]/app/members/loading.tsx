import { PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/Skeleton";

export default function MembersLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Members" />
      <ul className="mt-6 space-y-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-8 w-14 rounded-lg" />
          </li>
        ))}
      </ul>
    </SkeletonPage>
  );
}
