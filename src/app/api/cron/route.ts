import type { NextRequest } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { trackListings } from "@/lib/radar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * งานตามรอบ: ตรวจแจ้งเตือน + จับเหรียญเข้ากระดานใหม่
 * ในเครื่อง: ตัวตั้งเวลาใน instrumentation.ts เรียกให้ทุกนาที
 * ออนไลน์: ให้บริการ cron ภายนอก (เช่น cron-job.org) เรียก /api/cron?key=<CRON_SECRET> ทุก 1 นาที
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.nextUrl.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || auth !== secret) return Response.json({ error: "forbidden" }, { status: 403 });
  const [alerts] = await Promise.all([checkAlerts(), trackListings().catch(() => null)]);
  return Response.json({ ok: true, alerts, at: Date.now() });
}
