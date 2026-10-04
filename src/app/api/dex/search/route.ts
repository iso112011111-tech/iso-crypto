import type { NextRequest } from "next/server";
import { searchDex } from "@/lib/dex";
import { getUsdThb } from "@/lib/market";

export const dynamic = "force-dynamic";

/** ค้นหาเหรียญบน DEX ทุกเชน ด้วยชื่อ สัญลักษณ์ หรือที่อยู่คอนแทรกต์ */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const fx = await getUsdThb();
    return Response.json(await searchDex(q, fx.rate));
  } catch {
    return Response.json([]);
  }
}
