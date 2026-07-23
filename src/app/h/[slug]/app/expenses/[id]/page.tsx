import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { ExpenseForm } from "../expense-form";
import type { SplitConfig, SplitMethod } from "@/lib/split";

export const dynamic = "force-dynamic";

export default async function EditExpense({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const { house, me, houseMembers } = await requireMember(params.slug);
  const expense = await db().query.expenses.findFirst({
    where: and(eq(expenses.id, Number(params.id)), eq(expenses.houseId, house.id)),
  });
  if (!expense) notFound();

  const config = expense.splitConfig as SplitConfig;
  const method = expense.splitMethod as SplitMethod;

  let participants: number[] = [];
  const values: Record<number, number> = {};
  switch (config.method) {
    case "equal":
      participants = config.participants;
      break;
    case "exact":
      participants = Object.keys(config.amounts).map(Number);
      for (const [id, c] of Object.entries(config.amounts)) values[Number(id)] = c / 100;
      break;
    case "percent":
      participants = Object.keys(config.percents).map(Number);
      for (const [id, p] of Object.entries(config.percents)) values[Number(id)] = p;
      break;
    case "shares":
      participants = Object.keys(config.shares).map(Number);
      for (const [id, s] of Object.entries(config.shares)) values[Number(id)] = s;
      break;
    case "adjustment":
      participants = config.participants;
      for (const [id, c] of Object.entries(config.adjustments)) values[Number(id)] = c / 100;
      break;
  }

  const editor = expense.updatedBy ? houseMembers.find((m) => m.id === expense.updatedBy) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Edit expense</h1>
      <p className="mt-1 text-xs text-inkmuted">
        Added by {houseMembers.find((m) => m.id === expense.createdBy)?.username ?? "?"}
        {editor ? ` · last edited by ${editor.username}` : ""}
      </p>
      <ExpenseForm
        slug={params.slug}
        meId={me.id}
        members={houseMembers.map((m) => ({ id: m.id, username: m.username, color: m.color }))}
        initial={{
          expenseId: expense.id,
          description: expense.description,
          amount: expense.amountCents / 100,
          category: expense.category,
          date: expense.date,
          payer: expense.payerMemberId,
          splitMethod: method,
          values,
          participants,
        }}
      />
    </main>
  );
}
