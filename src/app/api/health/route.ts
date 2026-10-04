import { getUniverse } from "@/lib/market";
import { getStore } from "@/lib/store";
import { aiConfigured } from "@/lib/ai";
import { pushConfigured } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const reach = (url: string) =>
  fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) }).then(
    (r) => (r.ok ? "ok" : `HTTP ${r.status}`),
    (e) => `error: ${(e as Error).message}`,
  );

/**
 * ตรวจความพร้อมหลังขึ้นออนไลน์: ค่าตั้งค่าครบไหม และเซิร์ฟเวอร์ต่อกระดานต่าง ๆ ได้ไหม
 * (กระดานบางแห่งบล็อก IP บางประเทศ — ถ้าขึ้น 403/451 ให้ย้าย region ใน vercel.json)
 * ไม่เปิดเผยค่าลับ บอกแค่ว่าตั้งแล้วหรือยัง
 */
export async function GET() {
  const [u, futures] = await Promise.all([
    getUniverse().catch(() => null),
    Promise.all([reach("https://fapi.binance.com/fapi/v1/ping"), reach("https://api.bybit.com/v5/market/time"), reach("https://www.okx.com/api/v5/public/time")]),
  ]);
  const config = {
    store: getStore().kind, // ควรเป็น "redis" บน Vercel
    ai: aiConfigured(),
    push: pushConfigured(),
    firebase: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    cronSecret: !!process.env.CRON_SECRET,
    region: process.env.VERCEL_REGION ?? "local",
  };
  const problems = [
    config.store !== "redis" && process.env.VERCEL && "ยังไม่ได้ต่อ Redis — แจ้งเตือน/โควตา/ประวัติ AI จะหายเมื่อรีสตาร์ท",
    !config.ai && "ยังไม่ได้ตั้ง AI_BASE_URL / AI_API_KEY",
    !config.push && "ยังไม่ได้ตั้งกุญแจ VAPID (แจ้งเตือนเข้ามือถือ)",
    !config.firebase && "ยังไม่ได้ตั้งค่า Firebase",
    !config.cronSecret && "ยังไม่ได้ตั้ง CRON_SECRET (งานตรวจแจ้งเตือนทุกนาที)",
    ...(u?.exchanges.filter((e) => !e.ok).map((e) => `ต่อกระดาน ${e.ex} ไม่ได้`) ?? ["โหลดข้อมูลตลาดไม่ได้"]),
    futures[0] !== "ok" && `Binance Futures: ${futures[0]}`,
    futures[1] !== "ok" && `Bybit: ${futures[1]}`,
  ].filter(Boolean);
  return Response.json({
    ok: problems.length === 0,
    problems,
    config,
    exchanges: u?.exchanges ?? [],
    coins: u?.coins.length ?? 0,
    futures: { binance: futures[0], bybit: futures[1], okx: futures[2] },
  });
}
