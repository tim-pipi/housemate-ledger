import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { houses, shoppingItems } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { sendMessage, escapeHtml, appLink } from "@/lib/telegram";
import { buildBalancesMessage, buildDigestMessage } from "@/lib/digest";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id?.toString();

  // Always 200 for update types we don't act on — Telegram retries non-200s.
  if (!text || !chatId) return NextResponse.json({ ok: true });

  const [command, ...rest] = text.trim().split(/\s+/);

  if (command === "/link") {
    const code = rest[0];
    if (!code) {
      await sendMessage(
        chatId,
        "Usage: /link &lt;code&gt; — generate a code in the app's Telegram settings page."
      );
      return NextResponse.json({ ok: true });
    }
    const house = await db().query.houses.findFirst({
      where: eq(houses.telegramLinkCode, code),
    });
    if (!house) {
      await sendMessage(chatId, "That code isn't valid. Generate a new one in the app and try again.");
      return NextResponse.json({ ok: true });
    }
    await db()
      .update(houses)
      .set({ telegramChatId: chatId, telegramLinkCode: null })
      .where(eq(houses.id, house.id));
    await sendMessage(
      chatId,
      `✅ Linked to <b>${escapeHtml(house.name)}</b>. This group will now get expense and settlement updates.\n\nApp: ${appLink(house.slug)}`
    );
    return NextResponse.json({ ok: true });
  }

  if (command === "/unlink") {
    const house = await db().query.houses.findFirst({
      where: eq(houses.telegramChatId, chatId),
    });
    if (house) {
      await db().update(houses).set({ telegramChatId: null }).where(eq(houses.id, house.id));
      await sendMessage(chatId, "Unlinked. This group will no longer get updates.");
    }
    return NextResponse.json({ ok: true });
  }

  if (command === "/shopping") {
    const house = await db().query.houses.findFirst({
      where: eq(houses.telegramChatId, chatId),
    });
    if (!house) {
      await sendMessage(chatId, "This group isn't linked to a house yet. Send /link <code> first.");
      return NextResponse.json({ ok: true });
    }
    const openItems = await db().query.shoppingItems.findMany({
      where: and(
        eq(shoppingItems.houseId, house.id),
        isNull(shoppingItems.boughtAt),
        isNull(shoppingItems.archivedAt)
      ),
    });
    const html =
      openItems.length === 0
        ? "🛒 Shopping list is empty."
        : [
            `🛒 <b>Shopping (${openItems.length} needed)</b>`,
            ...openItems.map(
              (i) => `• ${escapeHtml(i.name)}${i.note ? ` (${escapeHtml(i.note)})` : ""}`
            ),
          ].join("\n");
    await sendMessage(chatId, html);
    return NextResponse.json({ ok: true });
  }

  if (command === "/balances" || command === "/summary") {
    const house = await db().query.houses.findFirst({
      where: eq(houses.telegramChatId, chatId),
    });
    if (!house) {
      await sendMessage(chatId, "This group isn't linked to a house yet. Send /link <code> first.");
      return NextResponse.json({ ok: true });
    }
    const html =
      command === "/balances" ? await buildBalancesMessage(house) : await buildDigestMessage(house);
    await sendMessage(chatId, html);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
