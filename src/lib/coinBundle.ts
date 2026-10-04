import "server-only";
import { getCandles, getUsdThb } from "./market";
import { estimateSlippage, getDexCandles, getDexSafety, getDexToken } from "./dex";
import { getDerivatives } from "./derivatives";
import { flowOf, multiTimeframe } from "./signals";
import { analyze, MIN_CANDLES } from "./analyzer";
import { withLivePrice } from "./indicators";
import type { Candle, CoinResponse } from "./types";

const youngNotice = (name: string, n: number) =>
  `${name} เพิ่งเข้าตลาด มีข้อมูลแค่ ${n} วัน (ต้องมีอย่างน้อย ${MIN_CANDLES} วัน) — ยังวิเคราะห์ทางเทคนิคไม่ได้ ถ้าจะเล่นให้ถือว่าเสี่ยงสูงมาก`;

/**
 * ข้อมูลครบชุดของเหรียญเดียว (ใช้ทั้ง API หน้าเว็บ และเป็นข้อมูลป้อนให้ AI)
 * id = "BTC" (เหรียญบนกระดาน) หรือ "dex:<chain>:<tokenAddress>" (เหรียญบน DEX)
 */
export async function getCoinBundle(id: string): Promise<CoinResponse> {
  const fx = await getUsdThb();
    if (id.startsWith("dex:")) {
      const [, chain, address] = id.split(":");
      const token = await getDexToken(chain, address, fx.rate);
      const [rawDaily, rawH4, safety] = await Promise.all([
        getDexCandles(token, fx.rate, "1d"),
        getDexCandles(token, fx.rate, "4h"),
        getDexSafety(token, fx.rate),
      ]);
      const daily = withLivePrice(rawDaily, token.price);
      const h4 = withLivePrice(rawH4, token.price, 4 * 3_600_000);
      const enough = daily.length >= MIN_CANDLES;
      const body: CoinResponse = {
        id: token.id,
        candles: daily,
        analysis: enough ? analyze(token.symbol, daily) : null,
        notice: enough ? undefined : daily.length ? youngNotice(token.symbol, daily.length) : `ยังไม่มีกราฟย้อนหลังของ ${token.symbol} บน ${token.chainName}`,
        market: null,
        dex: { ...token, safety, slippage: estimateSlippage(token.liquidity) },
        mtf: enough ? multiTimeframe(h4, daily) : null,
        flow: flowOf(daily, { buys: token.buys24h, sells: token.sells24h }),
        derivatives: null,
        usdThb: fx.rate,
        source: `${token.dexId} บน ${token.chainName} (ผ่าน GeckoTerminal)`,
      };
      return body;
    }

    const symbol = id.toUpperCase();
    const [{ candles: rawDaily, source, market }, rawH4] = await Promise.all([
      getCandles(symbol, 500, "1d"),
      getCandles(symbol, 300, "4h").then((r) => r.candles, () => [] as Candle[]),
    ]);
    // ประวัติแท่งเทียนแคชไว้ได้ แต่แท่งล่าสุดต้องเป็นราคาสด → วิเคราะห์ใหม่ทุกครั้งที่ราคาเปลี่ยน
    const candles = withLivePrice(rawDaily, market.price);
    const h4 = withLivePrice(rawH4, market.price, 4 * 3_600_000);
    const enough = candles.length >= MIN_CANDLES;
    const analysis = enough ? analyze(symbol, candles) : null;
    const derivatives = await getDerivatives(symbol, analysis?.change7d ?? null).catch(() => null);
    const body: CoinResponse = {
      id: symbol,
      candles,
      analysis,
      notice: enough ? undefined : youngNotice(symbol, candles.length),
      market,
      mtf: enough ? multiTimeframe(h4, candles) : null,
      flow: flowOf(candles),
      derivatives,
      usdThb: fx.rate,
      source: `${source} · แท่งรายวัน`,
    };
    return body;
}
