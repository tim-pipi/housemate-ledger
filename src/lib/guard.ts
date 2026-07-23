import { db } from "@/db";
import { houses, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function requireMember(slug: string) {
  const session = await getSession();
  if (!session || session.slug !== slug) redirect(`/h/${slug}`);
  const house = await db().query.houses.findFirst({ where: eq(houses.id, session.houseId) });
  if (!house || house.slug !== slug) redirect(`/h/${slug}`);
  const houseMembers = await db().query.members.findMany({
    where: eq(members.houseId, house.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
  const me = houseMembers.find((m) => m.id === session.memberId);
  if (!me) redirect(`/h/${slug}`);
  return { house, me, houseMembers };
}
