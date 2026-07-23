"use server";

import { db } from "@/db";
import { houses, members } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, clearSession } from "@/lib/session";
import { MEMBER_COLORS } from "@/lib/constants";
import { redirect } from "next/navigation";

export type LoginState = { error?: string } | undefined;

export async function loginOrJoin(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const slug = String(formData.get("slug") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username) return { error: "Enter a username." };
  if (username.length > 30) return { error: "Username is too long (max 30)." };

  const house = await db().query.houses.findFirst({ where: eq(houses.slug, slug) });
  if (!house) return { error: "This house link doesn't exist." };

  const existing = await db().query.members.findFirst({
    where: and(eq(members.houseId, house.id), eq(members.username, username)),
  });

  let memberId: number;
  if (existing) {
    if (existing.passwordHash) {
      if (!password) return { error: `“${username}” has a password. Enter it to log in.` };
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok) return { error: "Wrong password for this username." };
    }
    memberId = existing.id;
  } else {
    const count = (await db().query.members.findMany({ where: eq(members.houseId, house.id) }))
      .length;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const [row] = await db()
      .insert(members)
      .values({
        houseId: house.id,
        username,
        passwordHash,
        color: MEMBER_COLORS[count % MEMBER_COLORS.length],
      })
      .returning({ id: members.id });
    memberId = row.id;
  }

  await createSession({ memberId, houseId: house.id, slug });
  redirect(`/h/${slug}/app`);
}

export async function logout(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  clearSession();
  redirect(`/h/${slug}`);
}
