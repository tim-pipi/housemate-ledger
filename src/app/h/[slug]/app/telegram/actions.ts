"use server";

import { db } from "@/db";
import { houses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { requireMember } from "@/lib/guard";
import { revalidatePath } from "next/cache";

const linkCodeId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export async function generateLinkCode(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const code = linkCodeId();
  await db().update(houses).set({ telegramLinkCode: code }).where(eq(houses.id, house.id));
  revalidatePath(`/h/${slug}/app/telegram`);
}

export async function disconnectTelegram(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  await db()
    .update(houses)
    .set({ telegramChatId: null, telegramLinkCode: null })
    .where(eq(houses.id, house.id));
  revalidatePath(`/h/${slug}/app/telegram`);
}
