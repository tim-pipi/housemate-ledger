"use server";

import { db } from "@/db";
import { expenses, expenseShares, settlements } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import { resolveShares, type SplitConfig, type SplitMethod } from "@/lib/split";
import {
  notifyHouse,
  renderExpenseMessage,
  renderExpenseDeletedMessage,
  renderSettlementMessage,
  describeSplit,
} from "@/lib/telegram";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { error?: string } | undefined;

function parseAmountCents(raw: string): number {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) throw new Error("Enter a valid amount.");
  return Math.round(n * 100);
}

function parseSplitConfig(formData: FormData, memberIds: number[]): SplitConfig {
  const method = String(formData.get("splitMethod")) as SplitMethod;
  const participants = memberIds.filter((id) => formData.get(`p_${id}`) === "on");
  switch (method) {
    case "equal":
      return { method, participants };
    case "exact": {
      const amounts: Record<string, number> = {};
      for (const id of participants) {
        const v = Number(formData.get(`v_${id}`) ?? 0);
        if (v > 0) amounts[id] = Math.round(v * 100);
      }
      return { method, amounts };
    }
    case "percent": {
      const percents: Record<string, number> = {};
      for (const id of participants) {
        const v = Number(formData.get(`v_${id}`) ?? 0);
        if (v > 0) percents[id] = v;
      }
      return { method, percents };
    }
    case "shares": {
      const shares: Record<string, number> = {};
      for (const id of participants) {
        const v = Number(formData.get(`v_${id}`) ?? 0);
        if (v > 0) shares[id] = v;
      }
      return { method, shares };
    }
    case "adjustment": {
      const adjustments: Record<string, number> = {};
      for (const id of participants) {
        const v = Number(formData.get(`v_${id}`) ?? 0);
        if (v !== 0) adjustments[id] = Math.round(v * 100);
      }
      return { method, participants, adjustments };
    }
    default:
      throw new Error("Unknown split method.");
  }
}

export async function saveExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, me, houseMembers } = await requireMember(slug);
  const expenseId = formData.get("expenseId") ? Number(formData.get("expenseId")) : null;

  try {
    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new Error("Enter a description.");
    const amountCents = parseAmountCents(String(formData.get("amount")));
    const category = String(formData.get("category"));
    const date = String(formData.get("date"));
    const payerMemberId = Number(formData.get("payer"));
    if (!houseMembers.some((m) => m.id === payerMemberId))
      throw new Error("Pick who paid.");

    const config = parseSplitConfig(formData, houseMembers.map((m) => m.id));
    const shares = resolveShares(amountCents, config, payerMemberId);

    if (expenseId) {
      const existing = await db().query.expenses.findFirst({
        where: and(eq(expenses.id, expenseId), eq(expenses.houseId, house.id)),
      });
      if (!existing) throw new Error("Expense not found.");
      await db()
        .update(expenses)
        .set({
          description,
          amountCents,
          category,
          date,
          payerMemberId,
          splitMethod: config.method,
          splitConfig: config,
          updatedBy: me.id,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId));
      await db().delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
      await db()
        .insert(expenseShares)
        .values(
          Object.entries(shares).map(([memberId, shareCents]) => ({
            expenseId,
            memberId: Number(memberId),
            shareCents,
          }))
        );

      const editPayer = houseMembers.find((m) => m.id === payerMemberId);
      if (editPayer) {
        await notifyHouse(
          house.id,
          renderExpenseMessage({
            description,
            amountCents,
            category,
            payerName: editPayer.username,
            splitLabel: describeSplit(config),
            shares: Object.entries(shares).map(([memberId, cents]) => ({
              name: houseMembers.find((m) => m.id === Number(memberId))?.username ?? "?",
              cents,
            })),
            emoji: "✏️",
            suffix: "(edited)",
          })
        );
      }
    } else {
      const [row] = await db()
        .insert(expenses)
        .values({
          houseId: house.id,
          description,
          amountCents,
          category,
          date,
          payerMemberId,
          splitMethod: config.method,
          splitConfig: config,
          createdBy: me.id,
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

      const payer = houseMembers.find((m) => m.id === payerMemberId);
      if (payer) {
        await notifyHouse(
          house.id,
          renderExpenseMessage({
            description,
            amountCents,
            category,
            payerName: payer.username,
            splitLabel: describeSplit(config),
            shares: Object.entries(shares).map(([memberId, cents]) => ({
              name: houseMembers.find((m) => m.id === Number(memberId))?.username ?? "?",
              cents,
            })),
          })
        );
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(`/h/${slug}/app`);
  redirect(`/h/${slug}/app`);
}

export async function deleteExpense(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const id = Number(formData.get("expenseId"));
  const existing = await db().query.expenses.findFirst({
    where: and(eq(expenses.id, id), eq(expenses.houseId, house.id)),
  });
  await db()
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.houseId, house.id)));
  if (existing) {
    await notifyHouse(
      house.id,
      renderExpenseDeletedMessage({
        description: existing.description,
        amountCents: existing.amountCents,
      })
    );
  }
  revalidatePath(`/h/${slug}/app`);
  redirect(`/h/${slug}/app`);
}

export async function settleUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, me, houseMembers } = await requireMember(slug);
  try {
    const fromMemberId = Number(formData.get("from"));
    const toMemberId = Number(formData.get("to"));
    const amountCents = parseAmountCents(String(formData.get("amount")));
    if (fromMemberId === toMemberId) throw new Error("Pick two different people.");
    const ids = houseMembers.map((m) => m.id);
    if (!ids.includes(fromMemberId) || !ids.includes(toMemberId))
      throw new Error("Unknown member.");
    const note = String(formData.get("note") ?? "").trim() || null;
    const date = String(formData.get("date") || new Date().toISOString().slice(0, 10));
    await db().insert(settlements).values({
      houseId: house.id,
      fromMemberId,
      toMemberId,
      amountCents,
      date,
      note,
      createdBy: me.id,
    });
    const from = houseMembers.find((m) => m.id === fromMemberId);
    const to = houseMembers.find((m) => m.id === toMemberId);
    if (from && to) {
      await notifyHouse(
        house.id,
        renderSettlementMessage({ fromName: from.username, toName: to.username, amountCents })
      );
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(`/h/${slug}/app`);
  return undefined;
}

export async function quickSettle(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house, me, houseMembers } = await requireMember(slug);
  const fromMemberId = Number(formData.get("from"));
  const toMemberId = Number(formData.get("to"));
  const amountCents = Number(formData.get("amountCents"));
  if (fromMemberId !== toMemberId && amountCents > 0) {
    await db().insert(settlements).values({
      houseId: house.id,
      fromMemberId,
      toMemberId,
      amountCents,
      date: new Date().toISOString().slice(0, 10),
      note: "Settled from balances",
      createdBy: me.id,
    });
    const from = houseMembers.find((m) => m.id === fromMemberId);
    const to = houseMembers.find((m) => m.id === toMemberId);
    if (from && to) {
      await notifyHouse(
        house.id,
        renderSettlementMessage({ fromName: from.username, toName: to.username, amountCents })
      );
    }
  }
  revalidatePath(`/h/${slug}/app`);
}
