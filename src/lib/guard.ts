import { db } from "@/db";
import { houses, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function requireMember(slug: string) {
  const session = await getSession();
  if (!session || session.slug !== slug) redirect(`/h/${slug}`);
  // Both queries run in parallel (one round trip instead of two on every page
  // and action). Members are fetched by the session's houseId and only
  // returned once the house row below confirms that id matches this slug.
  const [house, houseMembers] = await Promise.all([
    db().query.houses.findFirst({ where: eq(houses.id, session.houseId) }),
    db().query.members.findMany({
      where: eq(members.houseId, session.houseId),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    }),
  ]);
  if (!house || house.slug !== slug) redirect(`/h/${slug}`);
  const me = houseMembers.find((m) => m.id === session.memberId);
  if (!me) redirect(`/h/${slug}`);
  return { house, me, houseMembers };
}
