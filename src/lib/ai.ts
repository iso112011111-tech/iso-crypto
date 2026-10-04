import "server-only";
import { getCoinBundle } from "./coinBundle";
import { runScan } from "./scan";
import { getMarkets, getUniverse } from "./market";
import { runValidation } from "./validateRun";
import { getStore } from "./store";
import type { CoinResponse, Holding } from "./types";

/**
 * "iso AI" — ผู้ช่วยวิเคราะห์ที่อ่านตัวเลขทั้งหมดที่ระบบคำนวณและทดสอบแล้ว แล้วสังเคราะห์เป็นแผน
 * AI ไม่ได้ทำนายราคาเอง: ความมั่นใจถูกยึดกับสถิติย้อนหลังของคะแนนที่ส่งให้
 */

export const MODELS = {
  deep: "gemini-3.1-pro-preview", // วิเคราะห์เชิงลึก
  fast: "gemini-3.8-flash", // แชตทั่วไป ตอบไว
} as const;
export type ModelKey = keyof typeof MODELS;

export function aiConfigured() {
  return !!(process.env.AI_API_KEY && process.env.AI_BASE_URL);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** เรียกโมเดลแบบสตรีม คืน ReadableStream ของข้อความล้วน */
export async function streamChat(messages: ChatMessage[], model: ModelKey): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${process.env.AI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
    // โมเดลตระกูลนี้นับ "ความคิด" รวมใน max_tokens ด้วย จึงต้องเผื่อเยอะ
    body: JSON.stringify({ model: MODELS[model], messages, stream: true, max_tokens: 12000, temperature: 0.3 }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${detail.slice(0, 200)}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  return res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const text = JSON.parse(data).choices?.[0]?.delta?.content;
            if (text) ctrl.enqueue(encoder.encode(text));
          } catch {
            /* บรรทัดไม่ครบ ข้าม */
          }
        }
      },
    }),
  );
}

/* ---------- กันใช้เครดิตเกิน: จำกัดจำนวนครั้งต่อ IP ---------- */
const hits = new Map<string, number[]>();
export function rateLimited(ip: string, max = 20, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

/* ---------- ข้อมูลป้อนให้ AI ---------- */

const r = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));
const thb = (v: number | null | undefined) => (v == null ? null : v >= 100 ? Math.round(v) : +v.toPrecision(5));

/** ย่อข้อมูลเหรียญให้เหลือเฉพาะตัวเลขสำคัญ (ประหยัด token และลดโอกาสหลงประเด็น) */
export function compactCoin(c: CoinResponse) {
  const a = c.analysis;
  return {
    id: c.id,
    symbol: c.dex?.symbol ?? c.market?.symbol ?? c.id,
    priceTHB: thb(c.dex?.price ?? c.market?.price ?? a?.price),
    change24hPct: r(c.dex?.change24h ?? c.market?.change24h),
    historyDays: c.candles.length,
    notice: c.notice,
    analysis: a && {
      setupScore: a.score,
      verdict: a.verdict.headline,
      risk: a.risk,
      trend: a.trend,
      factors: a.factors.map((f) => `${f.label} ${f.points}/${f.max} (${f.note})`),
      rsi: r(a.rsi, 0),
      atrPctPerDay: r(a.atrPct),
      annualVolatilityPct: r(a.volatility, 0),
      change7dPct: r(a.change7d, 1),
      change30dPct: r(a.change30d, 1),
      fromHigh90dPct: r(a.fromHigh90d, 1),
      volume7dVs30d: r(a.volRatio),
      ema: { ema20: thb(a.ema20), ema50: thb(a.ema50), ema200: thb(a.ema200) },
      supports: a.supports.map(thb),
      resistances: a.resistances.map(thb),
      systemTrade: { entry: thb(a.trade.entry), stopLoss: thb(a.trade.stopLoss), takeProfit: thb(a.trade.takeProfit), riskReward: r(a.trade.rrr) },
    },
    multiTimeframe: c.mtf && { rows: c.mtf.rows.map((x) => `${x.tf}: ${x.note} RSI ${x.rsi.toFixed(0)}`), summary: c.mtf.summary },
    flow: c.flow && { volSpikeYesterday: r(c.flow.volSpike), takerBuy7d: r(c.flow.takerBuy7d), dexBuys24h: c.flow.dexBuys24h, dexSells24h: c.flow.dexSells24h, notes: c.flow.notes },
    futures: c.derivatives && {
      fundingAvgPct8h: r(c.derivatives.fundingAvg, 4),
      openInterestUSD: c.derivatives.oiUsd && Math.round(c.derivatives.oiUsd),
      oiChange7dPct: r(c.derivatives.oiChange7d, 1),
      longShortAccounts: r(c.derivatives.longShort),
      notes: c.derivatives.notes.map((n) => n.text),
    },
    exchanges: c.market && {
      list: c.market.exchanges.map((e) => e.ex),
      bitkubPremiumPct: r(c.market.bitkubPremium),
      binanceThPremiumPct: r(c.market.binanceThPremium),
      buyableOnBinanceTH: !!c.market.onBinanceTH,
      volume24hTHB: Math.round(c.market.quoteVolume),
      marketCapRank: c.market.rank,
    },
    dex: c.dex && {
      chain: c.dex.chainName,
      liquidityTHB: Math.round(c.dex.liquidity),
      volume24hTHB: Math.round(c.dex.volume24h),
      pools: c.dex.pools,
      poolAgeDays: c.dex.createdAt ? Math.floor((Date.now() - c.dex.createdAt) / 86_400_000) : null,
      safetyScore: c.dex.safety.score,
      safetyChecks: c.dex.safety.checks.map((x) => `${x.status.toUpperCase()} ${x.label}: ${x.detail}`),
      sellSlippage: c.dex.slippage.map((x) => `ขาย ฿${x.amount}: -${x.impactPct.toFixed(1)}%`),
    },
  };
}

/** สถิติความแม่นยำของ Setup Score — ให้ AI ยึดความมั่นใจกับตัวเลขจริง ไม่ใช่ความรู้สึก */
export async function scoreStats() {
  try {
    const d = await runValidation(20, 30);
    return {
      note: "ทดสอบย้อนหลัง 20 เหรียญวอลุ่มสูงสุด ถือ 30 วัน · winRate = สัดส่วนที่แตะ TP ก่อน SL",
      baselineWinRate: r(d.baseline.winRate),
      buckets: d.buckets.map((b) => ({ range: b.label, winRate: r(b.winRate), avgReturnPct: r(b.avgRet, 1), samples: b.n })),
    };
  } catch {
    return null;
  }
}

export async function marketContext() {
  const [m, btc, scan] = await Promise.all([
    getMarkets({ limit: 1 }),
    getCoinBundle("BTC").catch(() => null),
    runScan("top50").catch(() => null),
  ]);
  return {
    now: new Date().toISOString(),
    usdThb: r(m.usdThb),
    fearGreed: m.fearGreed && { value: m.fearGreed.value, label: m.fearGreed.label, last7: m.fearGreed.history.slice(-7) },
    btcDominancePct: r(m.btcDominance, 1),
    totalMarketCap24hPct: r(m.totalMarketCapChange24h),
    btc: btc && compactCoin(btc),
    topSetupsTop50: scan?.rows.slice(0, 10).map((x) => ({
      symbol: x.symbol,
      score: x.analysis.score,
      risk: x.analysis.risk,
      priceTHB: thb(x.analysis.price),
      entry: thb(x.analysis.trade.entry),
      stopLoss: thb(x.analysis.trade.stopLoss),
      takeProfit: thb(x.analysis.trade.takeProfit),
      rr: r(x.analysis.trade.rrr, 1),
      atrPctPerDay: r(x.analysis.atrPct, 1),
      change7dPct: r(x.analysis.change7d, 1),
      verdict: x.analysis.verdict.headline,
    })),
    weakestTop50: scan?.rows.slice(-5).map((x) => ({ symbol: x.symbol, score: x.analysis.score })),
  };
}

/** หาเหรียญที่ผู้ใช้พูดถึงในข้อความ (เทียบกับรายชื่อจริงจากทุกกระดาน) */
export async function mentionedCoins(text: string): Promise<string[]> {
  const u = await getUniverse();
  const words = new Set(text.toUpperCase().match(/[A-Z0-9]{2,12}/g) ?? []);
  const ignore = new Set(["AI", "RSI", "EMA", "ATR", "SL", "TP", "THB", "USD", "USDT", "DCA", "OK", "ATH", "OI", "MACD", "ETF", "CEX", "DEX", "BUY", "SELL"]);
  const found = [...words].filter((w) => !ignore.has(w) && u.bySymbol.has(w));
  const dex = text.match(/dex:[a-z0-9-]+:[A-Za-z0-9]+/g) ?? [];
  return [...new Set([...dex, ...found])].slice(0, 3);
}

/* ---------- พรอมต์ ---------- */

export const SYSTEM_PROMPT = `คุณคือ "iso AI" นักวิเคราะห์คริปโตเชิงปริมาณของแอป iso-crypto สำหรับคนไทย

หลักการที่ห้ามละเมิด:
1. ใช้เฉพาะข้อมูลใน <data> เท่านั้น ห้ามแต่งตัวเลข ราคา ข่าว หรือเหตุการณ์ที่ไม่มีในข้อมูล ถ้าข้อมูลไม่พอให้บอกตรง ๆ
2. ไม่มีใครรู้อนาคต ห้ามสัญญากำไร ห้ามใช้คำว่า "การันตี/ขึ้นแน่/รวยแน่" ให้พูดเป็นความน่าจะเป็น และยึดกับสถิติย้อนหลังใน scoreStats (เช่น คะแนน 75+ ในอดีตชนะ ~54% เทียบสุ่ม ~45%)
3. ความอยู่รอดมาก่อนกำไร: ทุกแผนต้องมีจุดตัดขาดทุน (SL) และขนาดไม้ที่เสี่ยงไม่เกิน 1–2% ของพอร์ตต่อเทรด (สูตร: เงินที่ลงได้ = พอร์ต × %เสี่ยง ÷ ระยะถึง SL)
4. เหรียญ DEX ที่ safetyScore ต่ำ สภาพคล่องน้อย หรือมี FAIL ในการตรวจสัญญา ให้เตือนชัด ๆ และแนะนำ "ไม่เล่น" หรือไม้เล็กมาก
5. ถ้าสัญญาณขัดกัน หรือความเสี่ยงไม่คุ้ม การ "รอ" หรือ "ไม่เล่น" คือคำตอบที่ดี กล้าบอก
6. ชี้ว่าอะไรจะทำให้มุมมองนี้ผิด (invalidation) เสมอ
7. ตอบภาษาไทย กระชับ ตรงประเด็น สไตล์นักเทรดมืออาชีพ ใช้ตัวเลขจริงจากข้อมูล ราคาเป็นบาท ใช้ Markdown (หัวข้อ ## รายการ - ตัวหนา **)`;

export const COIN_TASK = `วิเคราะห์เหรียญนี้เชิงลึกตามโครงนี้ (ห้ามเกิน ~450 คำ):

## สรุปใน 1 บรรทัด
## ภาพใหญ่
(แนวโน้มหลายกรอบเวลา + ภาวะตลาดรวม/BTC มีผลต่อเหรียญนี้อย่างไร)
## หลักฐานฝั่งบวก / ฝั่งลบ
(ใช้ตัวเลขจริง: คะแนนแต่ละปัจจัย แรงซื้อขาย ฟิวเจอร์ส ส่วนต่าง Bitkub ความปลอดภัย DEX)
## แผนเทรด
- โซนเข้า / จุดตัดขาดทุน / เป้ากำไร 1-2 (อิงแนวรับ-ต้านที่ให้)
- ขนาดไม้ตัวอย่างสำหรับพอร์ต ฿100,000 ที่เสี่ยง 1%
## 3 สถานการณ์
(ขาขึ้น / กลาง / ขาลง พร้อม % ความน่าจะเป็นคร่าว ๆ ที่สอดคล้องกับ scoreStats และระดับราคาที่ต้องจับตา)
## อะไรจะทำให้มุมมองนี้ผิด

บรรทัดสุดท้ายต้องเป็นรูปแบบนี้เป๊ะ ๆ (ระบบจะอ่านอัตโนมัติ):
VERDICT: <เข้า|ทยอย|รอ|หลีกเลี่ยง> | CONFIDENCE: <0-100>

CONFIDENCE คือ "โอกาสที่แผนนี้แตะเป้ากำไรก่อนจุดตัดขาดทุน" ไม่ใช่คะแนน Setup Score:
- เริ่มจาก winRate ของช่วงคะแนนที่เหรียญนี้อยู่ใน scoreStats (×100)
- ปรับขึ้น/ลงได้ไม่เกิน ±10 ตามหลักฐานเพิ่มเติม (หลายกรอบเวลา ฟิวเจอร์ส แรงซื้อขาย ความปลอดภัย DEX)
- ถ้าไม่มี scoreStats หรือไม่มีผลวิเคราะห์ ให้ไม่เกิน 50
- ตัวเลขใน "3 สถานการณ์" ต้องสอดคล้องกับ CONFIDENCE`;

/* ---------- บันทึกคำตัดสินของ AI เพื่อตรวจผลย้อนหลัง ---------- */

export type AiCall = { id: string; assetId: string; symbol: string; verdict: string; confidence: number; price: number; score: number | null; at: number; model: string };

export function parseVerdict(text: string): { verdict: string; confidence: number } | null {
  const m = text.match(/VERDICT:\s*(เข้า|ทยอย|รอ|หลีกเลี่ยง)\s*\|\s*CONFIDENCE:\s*(\d{1,3})/);
  return m ? { verdict: m[1], confidence: Math.min(100, +m[2]) } : null;
}

export async function saveCall(call: AiCall) {
  const store = getStore();
  const list = (await store.get<AiCall[]>("ai:calls")) ?? [];
  await store.set("ai:calls", [call, ...list].slice(0, 500));
}

export async function listCalls(): Promise<AiCall[]> {
  return (await getStore().get<AiCall[]>("ai:calls")) ?? [];
}

export type PortfolioInput = Holding[];
