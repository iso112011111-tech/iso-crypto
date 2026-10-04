import type { NextRequest } from "next/server";
import { getFuturesRadar, getListings, getPremiums } from "@/lib/radar";

export const dynamic = "force-dynamic";

/** เรดาร์: ?tab=futures | listings | premium */
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "futures";
  try {
    if (tab === "listings") return Response.json(await getListings());
    if (tab === "premium") return Response.json(await getPremiums());
    return Response.json(await getFuturesRadar());
  } catch (e) {
    return Response.json({ error: "โหลดเรดาร์ไม่สำเร็จ", detail: String(e) }, { status: 502 });
  }
}
