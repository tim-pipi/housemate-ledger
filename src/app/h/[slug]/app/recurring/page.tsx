import Link from "next/link";
import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { fmtSGD } from "@/lib/constants";
import { sgToday } from "@/lib/recurring";
import { postNow } from "./actions";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  equal: "equal",
  exact: "exact amounts",
  percent: "percentages",
  shares: "shares",
  adjustment: "equal + adjustments",
};

export default async function Recurring({ params }: { params: { slug: string } }) {
  const { house, houseMembers } = await requireMember(params.slug);
  const byId = new Map(houseMembers.map((m) => [m.id, m]));
  const templates = await db().query.recurringTemplates.findMany({
    where: eq(recurringTemplates.houseId, house.id),
    orderBy: (t, { asc }) => [asc(t.dayOfMonth), asc(t.id)],
  });
  const { ym } = sgToday();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app`} className="text-sm text-inkmuted hover:underline">
        ← Back to dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Recurring bills</h1>
        <Link href={`/h/${params.slug}/app/recurring/new`} className="btn-primary text-sm">
          + New template
        </Link>
      </div>
      <p className="mt-1 text-sm text-inkmuted">
        Templates post automatically as an expense on their day each month (just
        after midnight SGT). Edit the posted expense afterwards if the actual
        bill differs.
      </p>

      {templates.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
          No templates yet. Start with rent — it'll post itself every month.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/h/${params.slug}/app/recurring/${t.id}`}
                  className="min-w-0 flex-1 hover:text-accent"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {t.description}
                    {!t.active && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-xs text-inkmuted">
                        paused
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-inkmuted">
                    Day {t.dayOfMonth} · {t.category} · paid by{" "}
                    {byId.get(t.payerMemberId)?.username} · split{" "}
                    {METHOD_LABEL[t.splitMethod] ?? t.splitMethod}
                  </span>
                </Link>
                <span className="tnum font-display font-semibold">{fmtSGD(t.amountCents)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-inkmuted">
                  {t.lastPostedMonth === ym
                    ? `Posted for ${ym}`
                    : t.lastPostedMonth
                    ? `Last posted ${t.lastPostedMonth}`
                    : "Never posted"}
                </span>
                {t.active === 1 && t.lastPostedMonth !== ym && (
                  <form action={postNow}>
                    <input type="hidden" name="slug" value={params.slug} />
                    <input type="hidden" name="templateId" value={t.id} />
                    <button className="btn-ghost px-3 py-1 text-xs">
                      Post {ym} now
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
