import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { houses } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { sgToday, sgIsSunday } from "@/lib/recurring";
import { sendMessage } from "@/lib/telegram";
import { buildDigestMessage } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sgIsSunday()) return NextResponse.json({ sent: 0, reason: "not-sunday" });

  const { ym, day } = sgToday();
  const today = `${ym}-${String(day).padStart(2, "0")}`;

  const linked = await db().query.houses.findMany({ where: isNotNull(houses.telegramChatId) });
  let sent = 0;
  for (const house of linked) {
    if (!house.telegramChatId || house.lastDigestDate === today) continue;
    const html = await buildDigestMessage(house);
    await sendMessage(house.telegramChatId, html);
    await db().update(houses).set({ lastDigestDate: today }).where(eq(houses.id, house.id));
    sent++;
  }
  return NextResponse.json({ sent });
}
