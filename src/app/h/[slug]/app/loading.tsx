import { BalancesSkeleton, DashboardActivitySkeleton, Skeleton, SkeletonPage } from "@/components/Skeleton";
import { KampungMark } from "@/components/KampungArt";

export default function DashboardLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-36 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <KampungMark className="h-3.5 w-3.5" />
            Kampung
          </p>
          <Skeleton className="mt-1 h-7 w-44" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </header>
      <BalancesSkeleton />
      <DashboardActivitySkeleton />
    </SkeletonPage>
  );
}
