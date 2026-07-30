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

export function appLink(slug: string): string {
  const appUrl = process.env.APP_URL;
  return appUrl ? `${appUrl}/h/${slug}/app` : `/h/${slug}/app`;
}

// The only function the rest of the app should call to notify a house's group.
export async function notifyHouse(houseId: number, html: string): Promise<void> {
  const house = await db().query.houses.findFirst({ where: eq(houses.id, houseId) });
  if (!house?.telegramChatId) return;
  await sendMessage(house.telegramChatId, `${html}\n\nCheck the activity: ${appLink(house.slug)}`);
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
  shares: { name: string; cents: number }[];
  emoji?: string;
  suffix?: string;
}): string {
  const emoji = opts.emoji ?? "🧾";
  const suffix = opts.suffix ? ` ${opts.suffix}` : "";
  const breakdown = opts.shares.map((s) => `${escapeHtml(s.name)} owes ${fmtSGD(s.cents)}`).join(" · ");
  return (
    `${emoji} <b>${escapeHtml(opts.description)}</b> — ${fmtSGD(opts.amountCents)}${suffix}\n` +
    `Paid by ${escapeHtml(opts.payerName)} · ${escapeHtml(opts.category)} · ${escapeHtml(opts.splitLabel)}\n` +
    breakdown
  );
}

export function renderExpenseDeletedMessage(opts: {
  description: string;
  amountCents: number;
}): string {
  return `🗑️ <b>${escapeHtml(opts.description)}</b> — ${fmtSGD(opts.amountCents)} deleted`;
}

export function renderSettlementMessage(opts: {
  fromName: string;
  toName: string;
  amountCents: number;
}): string {
  return `💸 ${escapeHtml(opts.fromName)} paid ${escapeHtml(opts.toName)} ${fmtSGD(opts.amountCents)} — settled`;
}

export function renderShoppingAddedMessage(opts: {
  name: string;
  note: string | null;
  addedByName: string;
}): string {
  const note = opts.note ? ` (${escapeHtml(opts.note)})` : "";
  return `🛒 ${escapeHtml(opts.addedByName)} added <b>${escapeHtml(opts.name)}</b>${note}`;
}

export function renderShoppingBoughtMessage(opts: {
  name: string;
  boughtByName: string;
}): string {
  return `✅ ${escapeHtml(opts.boughtByName)} bought <b>${escapeHtml(opts.name)}</b> — no need to buy it`;
}

// Takes plain labels rather than a Recurrence object so this module never
// needs to import from lib/events.ts (which imports notifyHouse from here).
export function renderEventCreatedMessage(opts: {
  title: string;
  dateLabel: string;
  createdByName: string;
}): string {
  return `📅 ${escapeHtml(opts.createdByName)} added <b>${escapeHtml(opts.title)}</b> — ${escapeHtml(
    opts.dateLabel
  )}`;
}

export function renderEventReminderMessage(opts: {
  title: string;
  note: string | null;
  recurrenceLabel: string | null; // null for one-off events
  when: "tomorrow" | "today";
}): string {
  const label = opts.when === "tomorrow" ? "Tomorrow" : "Today";
  const noteText = opts.note ? ` (${escapeHtml(opts.note)})` : "";
  const recurText = opts.recurrenceLabel ? ` — ${escapeHtml(opts.recurrenceLabel)}` : "";
  return `⏰ ${label}: <b>${escapeHtml(opts.title)}</b>${noteText}${recurText}`;
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
