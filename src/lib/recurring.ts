import { db } from "@/db";
import { expenses, expenseShares, recurringTemplates, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveShares, type SplitConfig } from "@/lib/split";
import { notifyHouse, renderRecurringMessage } from "@/lib/telegram";

// Current date parts in Singapore time, independent of server timezone.
export function sgToday(): { year: number; month: number; day: number; ym: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get("year"), month = get("month"), day = get("day");
  return { year, month, day, ym: `${year}-${String(month).padStart(2, "0")}` };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Whether "today" in Singapore time is a Sunday — drives the weekly digest cadence.
export function sgIsSunday(): boolean {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Singapore", weekday: "short" }).format(
      new Date()
    ) === "Sun"
  );
}

type Template = typeof recurringTemplates.$inferSelect;

// Posts the template's expense for the given month (idempotent via lastPostedMonth).
export async function postTemplate(t: Template, ym: string, day: number) {
  const config = t.splitConfig as SplitConfig;
  const shares = resolveShares(t.amountCents, config, t.payerMemberId);
  const date = `${ym}-${String(day).padStart(2, "0")}`;
  const [row] = await db()
    .insert(expenses)
    .values({
      houseId: t.houseId,
      description: t.description,
      amountCents: t.amountCents,
      category: t.category,
      date,
      payerMemberId: t.payerMemberId,
      splitMethod: config.method,
      splitConfig: config,
      createdBy: t.payerMemberId, // attributed to the payer; feed shows it as auto-posted via description
    })
    .returning({ id: expenses.id });
  await db()
    .insert(expenseShares)
    .values(
      Object.entries(shares).map(([memberId, shareCents]) => ({
        expenseId: row.id,
        memberId: Number(memberId),
        shareCents,
      }))
    );
  await db()
    .update(recurringTemplates)
    .set({ lastPostedMonth: ym })
    .where(eq(recurringTemplates.id, t.id));

  const houseMembers = await db().query.members.findMany({ where: eq(members.houseId, t.houseId) });
  const nameById = new Map(houseMembers.map((m) => [m.id, m.username]));
  await notifyHouse(
    t.houseId,
    renderRecurringMessage({
      description: t.description,
      amountCents: t.amountCents,
      shares: Object.entries(shares).map(([memberId, cents]) => ({
        name: nameById.get(Number(memberId)) ?? "?",
        cents,
      })),
    })
  );
}

// Runs all due templates. A template is due when today (SGT) has reached its
// day-of-month (clamped to the month's length, so day 31 posts on Feb 28/29)
// and it hasn't posted this month yet. Late cron runs catch up automatically.
export async function runDueTemplates(): Promise<{ posted: number; errors: string[] }> {
  const { year, month, day, ym } = sgToday();
  const dim = daysInMonth(year, month);
  const all = await db().query.recurringTemplates.findMany({
    where: eq(recurringTemplates.active, 1),
  });
  let posted = 0;
  const errors: string[] = [];
  for (const t of all) {
    const effectiveDay = Math.min(t.dayOfMonth, dim);
    if (day >= effectiveDay && t.lastPostedMonth !== ym) {
      try {
        await postTemplate(t, ym, effectiveDay);
        posted++;
      } catch (e) {
        errors.push(`template ${t.id}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }
  return { posted, errors };
}
