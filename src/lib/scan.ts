import "server-only";
import { filterCoins, getCandles, getUniverse } from "./market";
import { mapLimit } from "./http";
import { analyze, MIN_CANDLES } from "./analyzer";
import type { MarketCoin, ScanRow } from "./types";

/** ชุดเหรียญที่ให้สแกน — จำกัดจำนวนเพื่อไม่ให้ยิง API กระดานหนักเกินไป */
export const SETS: Record<string, { label: string; pick: (coins: MarketCoin[], usdThb: number) => MarketCoin[] }> = {
  top50: { label: "วอลุ่มสูงสุด 50", pick: (c) => c.slice(0, 50) },
  top150: { label: "วอลุ่มสูงสุด 150", pick: (c) => c.slice(0, 150) },
  movers: {
    label: "มาแรง 24 ชม.",
    pick: (c, usdThb) => {
      const liquid = c.slice(0, 400);
      const trending = liquid.filter((x) => x.trending);
      const gainers = filterCoins(liquid, { sort: "gainers" }, usdThb).slice(0, 40);
      return [...new Map([...trending, ...gainers].map((x) => [x.symbol, x])).values()];
    },
  },
  small: { label: "เหรียญเล็ก/ใหม่", pick: (c) => filterCoins(c, { filter: "small" }).slice(0, 60) },
  bitkub: { label: "มีบน Bitkub", pick: (c) => filterCoins(c, { filter: "bitkub" }).slice(0, 120) },
  binanceth: { label: "มีบน Binance TH", pick: (c) => filterCoins(c, { filter: "binanceth" }).slice(0, 150) },
};

export async function runScan(key: string) {
  const set = SETS[key] ?? SETS.top50;
  const u = await getUniverse();
  const targets = set.pick(u.coins, u.usdThb);

  const results = await mapLimit(targets, 8, async (c): Promise<ScanRow | null> => {
    const { candles, source } = await getCandles(c.symbol, 500);
    if (candles.length < MIN_CANDLES) return null;
    return { symbol: c.symbol, name: c.name, th: c.th, image: c.image, source, analysis: analyze(c.symbol, candles) };
  });

  const rows = results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    .sort((a, b) => b.analysis.score - a.analysis.score);
  return { rows, skipped: targets.length - rows.length, set: key in SETS ? key : "top50", label: set.label, scannedAt: Date.now() };
}
