import { aiConfigured, listCalls } from "@/lib/ai";
import { getDexToken } from "@/lib/dex";
import { getUniverse } from "@/lib/market";

export const dynamic = "force-dynamic";

/** ประวัติคำตัดสินของ AI + ราคาปัจจุบัน เพื่อดูว่า AI พูดถูกแค่ไหน */
export async function GET() {
  const [calls, u] = await Promise.all([listCalls(), getUniverse()]);
  const rows = await Promise.all(
    calls.slice(0, 100).map(async (c) => {
      let now: number | null = u.bySymbol.get(c.assetId)?.price ?? null;
      if (now == null && c.assetId.startsWith("dex:")) {
        const [, chain, addr] = c.assetId.split(":");
        now = await getDexToken(chain, addr, u.usdThb).then((t) => t.price, () => null);
      }
      return { ...c, now, changePct: now ? (now / c.price - 1) * 100 : null, ageHours: (Date.now() - c.at) / 3_600_000 };
    }),
  );
  return Response.json({ configured: aiConfigured(), calls: rows });
}
