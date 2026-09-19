import { PageHeaderSkeleton, ShoppingAddFormSkeleton, ShoppingListSkeleton, SkeletonPage } from "@/components/Skeleton";

export default function ShoppingLoading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeaderSkeleton title="Shopping list" />
      <p className="mt-1 text-sm text-inkmuted">
        Add what the house needs. Tick an item off once it&apos;s bought — bought items stay visible below so
        nobody double-buys.
      </p>
      <ShoppingAddFormSkeleton />
      <ShoppingListSkeleton />
    </SkeletonPage>
  );
}
