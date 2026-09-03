import { requireMember } from "@/lib/guard";
import { PageHeader } from "@/components/PageHeader";
import { NavTile } from "@/components/NavTile";

export const dynamic = "force-dynamic";

export default async function More({ params }: { params: { slug: string } }) {
  await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader backHref={`/h/${params.slug}/app`} title="More" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NavTile
          href={`/h/${params.slug}/app/recurring`}
          label="Recurring bills"
          description="Auto-posted monthly"
        />
        <NavTile
          href={`/h/${params.slug}/app/members`}
          label="Members"
          description="House roster"
        />
        <NavTile
          href={`/h/${params.slug}/app/telegram`}
          label="Telegram"
          description="Notifications"
        />
      </div>
    </main>
  );
}
