import { BalancesSkeleton, DashboardActivitySkeleton, Skeleton, SkeletonPage } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-36 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Housemate Ledger
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
