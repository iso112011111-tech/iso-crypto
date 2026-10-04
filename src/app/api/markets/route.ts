import type { NextRequest } from "next/server";
import { getMarkets, type MarketQuery } from "@/lib/market";

export const dynamic = "force-dynamic";

const SORTS = ["volume", "gainers", "losers", "mcap"] as const;
const FILTERS = ["all", "bitkub", "binanceth", "trending", "small"] as const;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const sort = p.get("sort") as MarketQuery["sort"];
  const filter = p.get("filter") as MarketQuery["filter"];
  const query: MarketQuery = {
    sort: SORTS.includes(sort!) ? sort : "volume",
    filter: FILTERS.includes(filter!) ? filter : "all",
    q: p.get("q") ?? undefined,
    symbols: p.get("symbols")?.split(",").filter(Boolean),
    limit: Number(p.get("limit")) || 50,
    offset: Number(p.get("offset")) || 0,
  };
  try {
    return Response.json(await getMarkets(query));
  } catch (e) {
    return Response.json({ error: "ดึงข้อมูลตลาดไม่สำเร็จ", detail: String(e) }, { status: 502 });
  }
}
