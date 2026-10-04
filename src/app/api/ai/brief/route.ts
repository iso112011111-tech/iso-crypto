import { BRIEF_TASK, SYSTEM_PROMPT, aiConfigured, briefSlot, completeChat, marketContext, scoreStats, type Brief } from "@/lib/ai";
import { cached } from "@/lib/http";
import { getFuturesRadar, getListings, getPremiums } from "@/lib/radar";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * สรุปตลาดจาก AI — สร้างใหม่แค่วันละ 2 รอบ (08:00 / 20:00 เวลาไทย) แล้วทุกคนใช้ฉบับเดียวกัน
 * ไม่ว่าจะมีคนเปิดดูกี่คน ค่าใช้จ่ายคงที่ ~2 ครั้ง/วัน
 */
export async function GET() {
  const store = getStore();
  const slot = briefSlot();
  const saved = await store.get<Brief>("ai:brief");
  if (saved?.slot === slot) return Response.json(saved);
  if (!aiConfigured()) return Response.json(saved ?? { error: "ยังไม่ได้ตั้งค่า AI" }, { status: saved ? 200 : 503 });

  try {
    // กันหลายคนเปิดพร้อมกันแล้วสั่ง AI ซ้ำ: งานเดียวกันในรอบเดียวกันรันครั้งเดียว
    const brief = await cached(`ai:brief:${slot}`, 12 * 3600_000, async () => {
      const [market, stats, futures, listings, premiums] = await Promise.all([
        marketContext(),
        scoreStats(),
        getFuturesRadar().catch(() => null),
        getListings(7).catch(() => null),
        getPremiums().catch(() => null),
      ]);
      const pick = <T extends { symbol: string }>(xs: T[] | undefined, n: number, f: (x: T) => object) => (xs ?? []).slice(0, n).map((x) => ({ symbol: x.symbol, ...f(x) }));
      const data = {
        market,
        scoreStats: stats,
        futures: futures && {
          marketFundingAvgPct: +futures.marketFundingAvg.toFixed(4),
          hotFunding: pick(futures.hotFunding, 5, (r) => ({ fundingPct: +r.fundingPct.toFixed(4), change24h: +r.change24h.toFixed(1) })),
          negativeFunding: pick(futures.negativeFunding, 5, (r) => ({ fundingPct: +r.fundingPct.toFixed(4), change24h: +r.change24h.toFixed(1) })),
          oiSurge: pick(futures.oiSurge, 5, (r) => ({ oiChange24h: r.oiChange24h && +r.oiChange24h.toFixed(1), change24h: +r.change24h.toFixed(1), note: r.tag })),
          squeezeCandidates: pick(futures.squeeze, 5, (r) => ({ fundingPct: +r.fundingPct.toFixed(4) })),
        },
        newListings7d: listings?.rows.slice(0, 8).map((r) => ({ symbol: r.symbol, exchange: r.exName, change24h: r.market && +r.market.change24h.toFixed(1) })),
        thaiPremiums: premiums?.rows.slice(0, 5).map((r) => ({ symbol: r.symbol, exchange: r.exName, premiumPct: +r.premiumPct.toFixed(2) })),
      };
      const text = await completeChat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `<data>\n${JSON.stringify(data)}\n</data>\n\n${BRIEF_TASK}` },
        ],
        "fast",
      );
      if (text.trim().length < 100) throw new Error("AI ตอบสั้นผิดปกติ");
      const b: Brief = { text, at: Date.now(), slot };
      await store.set("ai:brief", b);
      return b;
    });
    return Response.json(brief);
  } catch (e) {
    // สร้างใหม่ไม่ได้ → ส่งฉบับล่าสุดที่มีไปก่อน
    if (saved) return Response.json({ ...saved, stale: true });
    return Response.json({ error: "สร้างสรุปตลาดไม่สำเร็จ", detail: String((e as Error).message) }, { status: 502 });
  }
}
