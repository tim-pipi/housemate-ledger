"use server";

import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { resolveShares, type SplitConfig, type SplitMethod } from "@/lib/split";
import { postTemplate, sgToday, daysInMonth } from "@/lib/recurring";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { error?: string } | undefined;

function parseSplitConfig(formData: FormData, memberIds: number[]): SplitConfig {
  const method = String(formData.get("splitMethod")) as SplitMethod;
  const participants = memberIds.filter((id) => formData.get(`p_${id}`) === "on");
  const num = (id: number) => Number(formData.get(`v_${id}`) ?? 0);
  switch (method) {
    case "equal":
      return { method, participants };
    case "exact":
      return {
        method,
        amounts: Object.fromEntries(
          participants.filter((id) => num(id) > 0).map((id) => [id, Math.round(num(id) * 100)])
        ),
      };
    case "percent":
      return {
        method,
        percents: Object.fromEntries(
          participants.filter((id) => num(id) > 0).map((id) => [id, num(id)])
        ),
      };
    case "shares":
      return {
        method,
        shares: Object.fromEntries(
          participants.filter((id) => num(id) > 0).map((id) => [id, num(id)])
        ),
      };
    case "adjustment":
      return {
        method,
        participants,
        adjustments: Object.fromEntries(
          participants.filter((id) => num(id) !== 0).map((id) => [id, Math.round(num(id) * 100)])
        ),
      };
    default:
      throw new Error("Unknown split method.");
  }
}

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, houseMembers } = await requireMember(slug);
  const templateId = formData.get("templateId") ? Number(formData.get("templateId")) : null;

  try {
    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new Error("Enter a description.");
    const amount = Number(formData.get("amount"));
    if (!isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
    const amountCents = Math.round(amount * 100);
    const category = String(formData.get("category"));
    const dayOfMonth = Number(formData.get("dayOfMonth"));
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
      throw new Error("Day of month must be between 1 and 31.");
    const payerMemberId = Number(formData.get("payer"));
    if (!houseMembers.some((m) => m.id === payerMemberId)) throw new Error("Pick who pays.");
    const active = formData.get("active") === "on" ? 1 : 0;

    const config = parseSplitConfig(formData, houseMembers.map((m) => m.id));
    resolveShares(amountCents, config, payerMemberId); // validate now, not at 00:05 on the 1st

    const values = {
      description,
      amountCents,
      category,
      payerMemberId,
      splitMethod: config.method,
      splitConfig: config,
      dayOfMonth,
      active,
    };

    if (templateId) {
      const existing = await db().query.recurringTemplates.findFirst({
        where: and(eq(recurringTemplates.id, templateId), eq(recurringTemplates.houseId, house.id)),
      });
      if (!existing) throw new Error("Template not found.");
      await db().update(recurringTemplates).set(values).where(eq(recurringTemplates.id, templateId));
    } else {
      await db().insert(recurringTemplates).values({ ...values, houseId: house.id });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(`/h/${slug}/app/recurring`);
  redirect(`/h/${slug}/app/recurring`);
}

export async function deleteTemplate(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const id = Number(formData.get("templateId"));
  await db()
    .delete(recurringTemplates)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.houseId, house.id)));
  revalidatePath(`/h/${slug}/app/recurring`);
  redirect(`/h/${slug}/app/recurring`);
}

export async function postNow(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const id = Number(formData.get("templateId"));
  const t = await db().query.recurringTemplates.findFirst({
    where: and(eq(recurringTemplates.id, id), eq(recurringTemplates.houseId, house.id)),
  });
  const { year, month, day, ym } = sgToday();
  if (t && t.lastPostedMonth !== ym) {
    const effectiveDay = Math.min(Math.min(t.dayOfMonth, daysInMonth(year, month)), day);
    await postTemplate(t, ym, effectiveDay);
  }
  revalidatePath(`/h/${slug}/app`);
  revalidatePath(`/h/${slug}/app/recurring`);
}
