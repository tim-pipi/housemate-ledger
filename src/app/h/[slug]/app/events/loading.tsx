import { CalendarSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/Skeleton";

export default function CalendarLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Calendar" withAction />
      <p className="mt-1 text-sm text-inkmuted">
        Reminders for things that happen in the real world — paying the landlord, booking servicing, house
        dinners. Separate from the ledger&apos;s auto-posted recurring bills.
      </p>
      <div className="mt-4">
        <CalendarSkeleton />
      </div>
    </SkeletonPage>
  );
}
