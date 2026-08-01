import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { SubmitButton } from "@/components/SubmitButton";
import { generateLinkCode, disconnectTelegram } from "./actions";

export const dynamic = "force-dynamic";

export default async function TelegramPage({ params }: { params: { slug: string } }) {
  const { house } = await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Link href={`/h/${params.slug}/app`} className="text-sm text-inkmuted hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Telegram</h1>

      {house.telegramChatId ? (
        <div className="mt-6 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
            Connected — the linked group gets activity updates and a weekly digest.
          </p>
          <form action={disconnectTelegram} className="mt-3">
            <input type="hidden" name="slug" value={params.slug} />
            <SubmitButton className="btn-ghost px-3 py-1.5 text-sm" pendingLabel="Disconnecting…">
              Disconnect
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-inkmuted">Not connected.</p>
          {house.telegramLinkCode && (
            <div className="mt-3">
              <p className="text-sm">Add the bot to your group chat, then send:</p>
              <code className="mt-1 block rounded bg-paper px-3 py-2 font-mono text-sm">
                /link {house.telegramLinkCode}
              </code>
            </div>
          )}
          <form action={generateLinkCode} className="mt-3">
            <input type="hidden" name="slug" value={params.slug} />
            <SubmitButton className="btn-ghost px-3 py-1.5 text-sm" pendingLabel="Generating…">
              {house.telegramLinkCode ? "Generate new code" : "Connect Telegram"}
            </SubmitButton>
          </form>
        </div>
      )}

      <p className="mt-4 text-xs text-inkmuted">
        New expenses and settlements post to the linked group as they happen. A weekly
        digest goes out Sunday evenings with month-to-date spend and outstanding balances.
        In the group, <code>/balances</code> and <code>/summary</code> work on demand once linked.
      </p>
    </main>
  );
}
