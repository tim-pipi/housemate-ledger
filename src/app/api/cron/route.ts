import { NextRequest, NextResponse } from "next/server";
import { runDueTemplates } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDueTemplates();
  return NextResponse.json(result);
}
