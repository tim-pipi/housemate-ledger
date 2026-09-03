import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { buyItem, untickItem, clearBought } from "./actions";
import { ShoppingAddForm } from "./shopping-add-form";

export const dynamic = "force-dynamic";

export default async function ShoppingPage({ params }: { params: { slug: string } }) {
  const { house, houseMembers } = await requireMember(params.slug);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));

  const items = await db().query.shoppingItems.findMany({
    where: and(eq(shoppingItems.houseId, house.id), isNull(shoppingItems.archivedAt)),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const open = items.filter((i) => !i.boughtAt);
  const bought = [...items.filter((i) => i.boughtAt)].sort((a, b) =>
    (a.boughtAt as Date) < (b.boughtAt as Date) ? 1 : -1
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader
        backHref={`/h/${params.slug}/app`}
        title="Shopping list"
        description="Add what the house needs. Tick an item off once it's bought — bought items stay visible below so nobody double-buys."
      />

      <ShoppingAddForm slug={params.slug} />

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
          Needed{open.length > 0 ? ` (${open.length})` : ""}
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
            Nothing on the list.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {open.map((item) => (
              <Card as="li" key={item.id} className="flex items-center gap-3">
                <form action={buyItem}>
                  <input type="hidden" name="slug" value={params.slug} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <SubmitButton
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line transition-colors hover:border-accent"
                    aria-label={`Mark ${item.name} as bought`}
                    title="Mark as bought"
                    pendingLabel=""
                  />
                </form>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  {item.note && <span className="block text-xs text-inkmuted">{item.note}</span>}
                </span>
                <span className="shrink-0 text-xs text-inkmuted">
                  added by {byId.get(item.addedBy)?.username ?? "?"}
                </span>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {bought.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
              Bought ({bought.length})
            </h2>
            <form action={clearBought}>
              <input type="hidden" name="slug" value={params.slug} />
              <SubmitButton className="btn-ghost px-3 py-1 text-xs" pendingLabel="Clearing…">
                Clear bought
              </SubmitButton>
            </form>
          </div>
          <ul className="mt-2 space-y-2">
            {bought.map((item) => (
              <Card as="li" key={item.id} muted flat className="flex items-center gap-3">
                <form action={untickItem}>
                  <input type="hidden" name="slug" value={params.slug} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <SubmitButton
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white"
                    aria-label={`Mark ${item.name} as not bought`}
                    title="Undo — mark as not bought"
                    pendingLabel=""
                  >
                    ✓
                  </SubmitButton>
                </form>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium line-through">{item.name}</span>
                  {item.note && (
                    <span className="block text-xs text-inkmuted line-through">{item.note}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-inkmuted">
                  bought by {byId.get(item.boughtBy ?? -1)?.username ?? "?"}
                </span>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
