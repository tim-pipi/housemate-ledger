"use server";

import { db } from "@/db";
import { houses } from "@/db/schema";
import { customAlphabet } from "nanoid";
import { redirect } from "next/navigation";

const slugId = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz",
  12
);

export async function createHouse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const slug = slugId();
  await db().insert(houses).values({ name, slug });
  redirect(`/h/${slug}`);
}
