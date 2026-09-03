import { db } from "@/db";
import { expenses, settlements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { buildFeed } from "@/lib/activity";
import { PageHeader } from "@/components/PageHeader";
import { ActivityFeed } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function Activity({ params }: { params: { slug: string } }) {
  const { house, houseMembers } = await requireMember(params.slug);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));

  const [exp, setl] = await Promise.all([
    db().query.expenses.findMany({
      where: eq(expenses.houseId, house.id),
      orderBy: [desc(expenses.date), desc(expenses.id)],
    }),
    db().query.settlements.findMany({
      where: eq(settlements.houseId, house.id),
      orderBy: [desc(settlements.date), desc(settlements.id)],
    }),
  ]);

  const feed = buildFeed(exp, setl);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <PageHeader
        backHref={`/h/${params.slug}/app`}
        title="Activity"
        description="Full history of expenses and settlements."
      />
      <div className="mt-4">
        <ActivityFeed slug={params.slug} feed={feed} byId={byId} emptyMessage="No activity yet." />
      </div>
    </main>
  );
}
