import { db } from "@/db";
import { houses, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";
import { KampungSkyline } from "@/components/KampungArt";

export const dynamic = "force-dynamic";

export default async function HouseLogin({ params }: { params: { slug: string } }) {
  const house = await db().query.houses.findFirst({ where: eq(houses.slug, params.slug) });
  if (!house) notFound();

  const session = await getSession();
  if (session && session.houseId === house.id) redirect(`/h/${params.slug}/app`);

  const existing = await db().query.members.findMany({
    where: eq(members.houseId, house.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  return (
    <>
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 pb-40 pt-16 sm:pb-56">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        Kampung
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold">{house.name}</h1>
      <p className="mt-2 text-inkmuted">
        Pick your name or type a new one to join. Password is optional — set one
        the first time if you want to lock your name.
      </p>
      <LoginForm
        slug={params.slug}
        existing={existing.map((m) => ({ username: m.username, color: m.color, locked: !!m.passwordHash }))}
      />
    </main>
    {/* Same horizon as the landing page, a touch shorter — the member list can
        make this page tall, so it claims less of the viewport. */}
    <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 flex justify-center overflow-hidden">
      <KampungSkyline className="h-auto min-w-[560px] max-w-[1200px] opacity-80" />
    </div>
    </>
  );
}
