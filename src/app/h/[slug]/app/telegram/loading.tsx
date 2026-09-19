import { PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/Skeleton";

export default function TelegramLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Telegram" />
      <div className="mt-6 space-y-3 rounded-xl bg-white p-4 shadow-card" aria-hidden="true">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
    </SkeletonPage>
  );
}
