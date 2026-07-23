import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { RecurringForm } from "../recurring-form";
import type { SplitConfig, SplitMethod } from "@/lib/split";

export const dynamic = "force-dynamic";

export default async function EditTemplate({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const { house, me, houseMembers } = await requireMember(params.slug);
  const t = await db().query.recurringTemplates.findFirst({
    where: and(
      eq(recurringTemplates.id, Number(params.id)),
      eq(recurringTemplates.houseId, house.id)
    ),
  });
  if (!t) notFound();

  const config = t.splitConfig as SplitConfig;
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

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app/recurring`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Edit recurring bill</h1>
      <RecurringForm
        slug={params.slug}
        meId={me.id}
        members={houseMembers.map((m) => ({ id: m.id, username: m.username, color: m.color }))}
        initial={{
          templateId: t.id,
          description: t.description,
          amount: t.amountCents / 100,
          category: t.category,
          dayOfMonth: t.dayOfMonth,
          payer: t.payerMemberId,
          active: t.active === 1,
          splitMethod: t.splitMethod as SplitMethod,
          values,
          participants,
        }}
      />
    </main>
  );
}
