"use server";

import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireMember } from "@/lib/guard";
import { MEMBER_COLORS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { error?: string } | undefined;

export async function saveMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, houseMembers } = await requireMember(slug);
  const memberId = Number(formData.get("memberId"));
  const target = houseMembers.find((m) => m.id === memberId);
  if (!target) return { error: "Member not found." };

  try {
    const username = String(formData.get("username") ?? "").trim();
    if (!username) throw new Error("Enter a username.");
    if (username.length > 30) throw new Error("Username too long (max 30 chars).");

    if (username !== target.username) {
      const conflict = houseMembers.find((m) => m.id !== memberId && m.username === username);
      if (conflict) throw new Error("That username is already taken in this house.");
    }

    const color = String(formData.get("color") ?? target.color);
    if (!(MEMBER_COLORS as string[]).includes(color)) throw new Error("Invalid color.");

    const newPassword = String(formData.get("password") ?? "");
    const clearPassword = formData.get("clearPassword") === "on";
    let passwordHash = target.passwordHash;
    if (clearPassword) passwordHash = null;
    else if (newPassword) passwordHash = await bcrypt.hash(newPassword, 10);

    await db()
      .update(members)
      .set({ username, color, passwordHash })
      .where(and(eq(members.id, memberId), eq(members.houseId, house.id)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }

  revalidatePath(`/h/${slug}/app`);
  revalidatePath(`/h/${slug}/app/members`);
  redirect(`/h/${slug}/app/members`);
}

export async function toggleMemberActive(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house, me, houseMembers } = await requireMember(slug);
  const memberId = Number(formData.get("memberId"));
  if (memberId === me.id) return;

  const target = houseMembers.find((m) => m.id === memberId);
  if (!target) return;

  await db()
    .update(members)
    .set({ active: target.active ? 0 : 1 })
    .where(and(eq(members.id, memberId), eq(members.houseId, house.id)));

  revalidatePath(`/h/${slug}/app`);
  revalidatePath(`/h/${slug}/app/members`);
}
