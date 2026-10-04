import type { NextRequest } from "next/server";
import { UnknownCoinError } from "@/lib/market";
import { UnknownDexTokenError } from "@/lib/dex";
import { getCoinBundle } from "@/lib/coinBundle";

export const dynamic = "force-dynamic";

/** id = "BTC" (เหรียญบนกระดาน) หรือ "dex:<chain>:<tokenAddress>" (เหรียญบน DEX) */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const id = (p.get("id") ?? p.get("symbol") ?? "BTC").trim();
  try {
    return Response.json(await getCoinBundle(id));
  } catch (e) {
    if (e instanceof UnknownCoinError || e instanceof UnknownDexTokenError)
      return Response.json({ error: `ไม่พบเหรียญ ${id}` }, { status: 404 });
    return Response.json({ error: "ดึงข้อมูลเหรียญไม่สำเร็จ", detail: String(e) }, { status: 502 });
  }
}
