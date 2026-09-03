import Link from "next/link";
import { fmtSGD } from "@/lib/constants";
import type { FeedItem } from "@/lib/activity";

export function ActivityFeed({
  slug,
  feed,
  byId,
  emptyMessage = "No expenses yet. Add the first one to start the ledger.",
}: {
  slug: string;
  feed: FeedItem[];
  byId: Map<number, { username: string }>;
  emptyMessage?: string;
}) {
  if (feed.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-inkmuted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2">
      {feed.map((item) =>
        item.kind === "expense" ? (
          <li key={`e${item.id}`}>
            <Link
              href={`/h/${slug}/app/expenses/${item.id}`}
              className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-card transition-colors hover:bg-accentsoft/40"
            >
              <span>
                <span className="block font-medium">{item.e.description}</span>
                <span className="block text-xs text-inkmuted">
                  {item.e.category} · {item.e.date} · paid by {byId.get(item.e.payerMemberId)?.username}
                </span>
              </span>
              <span className="tnum font-display font-semibold">{fmtSGD(item.e.amountCents)}</span>
            </Link>
          </li>
        ) : (
          <li key={`s${item.id}`} className="flex items-center justify-between rounded-xl border border-line p-3.5">
            <span>
              <span className="block text-sm">
                {byId.get(item.s.fromMemberId)?.username} settled {byId.get(item.s.toMemberId)?.username}
              </span>
              <span className="block text-xs text-inkmuted">
                {item.s.date}
                {item.s.note ? ` · ${item.s.note}` : ""}
              </span>
            </span>
            <span className="tnum font-display font-semibold text-inkmuted">{fmtSGD(item.s.amountCents)}</span>
          </li>
        )
      )}
    </ul>
  );
}
