"use server";

import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { requireMember } from "@/lib/guard";
import {
  notifyHouse,
  renderShoppingAddedMessage,
  renderShoppingBoughtMessage,
} from "@/lib/telegram";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

export async function addItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug"));
  const { house, me } = await requireMember(slug);

  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Enter an item name.");
    const note = String(formData.get("note") ?? "").trim() || null;

    await db().insert(shoppingItems).values({ houseId: house.id, name, note, addedBy: me.id });

    await notifyHouse(
      house.id,
      renderShoppingAddedMessage({ name, note, addedByName: me.username })
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(`/h/${slug}/app/shopping`);
  revalidatePath(`/h/${slug}/app`);
  return undefined;
}

export async function buyItem(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house, me } = await requireMember(slug);
  const id = Number(formData.get("itemId"));

  const [item] = await db()
    .update(shoppingItems)
    .set({ boughtBy: me.id, boughtAt: new Date() })
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.houseId, house.id),
        isNull(shoppingItems.boughtAt)
      )
    )
    .returning();

  if (item) {
    await notifyHouse(
      house.id,
      renderShoppingBoughtMessage({ name: item.name, boughtByName: me.username })
    );
  }
  revalidatePath(`/h/${slug}/app/shopping`);
  revalidatePath(`/h/${slug}/app`);
}

export async function untickItem(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);
  const id = Number(formData.get("itemId"));

  await db()
    .update(shoppingItems)
    .set({ boughtBy: null, boughtAt: null })
    .where(and(eq(shoppingItems.id, id), eq(shoppingItems.houseId, house.id)));

  revalidatePath(`/h/${slug}/app/shopping`);
  revalidatePath(`/h/${slug}/app`);
}

export async function clearBought(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { house } = await requireMember(slug);

  await db()
    .update(shoppingItems)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(shoppingItems.houseId, house.id),
        isNotNull(shoppingItems.boughtAt),
        isNull(shoppingItems.archivedAt)
      )
    );

  revalidatePath(`/h/${slug}/app/shopping`);
  revalidatePath(`/h/${slug}/app`);
}
