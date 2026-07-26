import { db } from "@/db";
import { houses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fmtSGD } from "@/lib/constants";
import type { SplitConfig } from "@/lib/split";

const API_BASE = "https://api.telegram.org/bot";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Best-effort send: never throws, so a Telegram outage can't break a mutation.
export async function sendMessage(chatId: string, html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // swallow — best-effort delivery only
  }
}

// The only function the rest of the app should call to notify a house's group.
export async function notifyHouse(houseId: number, html: string): Promise<void> {
  const house = await db().query.houses.findFirst({ where: eq(houses.id, houseId) });
  if (!house?.telegramChatId) return;
  await sendMessage(house.telegramChatId, html);
}

export function describeSplit(config: SplitConfig): string {
  switch (config.method) {
    case "equal":
      return `split equally ${config.participants.length} ways`;
    case "exact":
      return "split by exact amounts";
    case "percent":
      return "split by percentage";
    case "shares":
      return "split by shares";
    case "adjustment":
      return "split with adjustments";
  }
}

export function renderExpenseMessage(opts: {
  description: string;
  amountCents: number;
  category: string;
  payerName: string;
  splitLabel: string;
}): string {
  return (
    `🧾 <b>${escapeHtml(opts.description)}</b> — ${fmtSGD(opts.amountCents)}\n` +
    `Paid by ${escapeHtml(opts.payerName)} · ${escapeHtml(opts.category)} · ${escapeHtml(opts.splitLabel)}`
  );
}

export function renderSettlementMessage(opts: {
  fromName: string;
  toName: string;
  amountCents: number;
}): string {
  return `💸 ${escapeHtml(opts.fromName)} paid ${escapeHtml(opts.toName)} ${fmtSGD(opts.amountCents)} — settled`;
}

export function renderRecurringMessage(opts: {
  description: string;
  amountCents: number;
  shares: { name: string; cents: number }[];
}): string {
  const breakdown = opts.shares.map((s) => `${escapeHtml(s.name)} ${fmtSGD(s.cents)}`).join(" · ");
  return (
    `🔁 <b>${escapeHtml(opts.description)}</b> — ${fmtSGD(opts.amountCents)} auto-posted\n${breakdown}`
  );
}
