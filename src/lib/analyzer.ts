import type { Analysis, Candle, Factor } from "./types";
import { annualizedVolatility, atr, ema, macdHistogram, mean, rsi, supportResistance } from "./indicators";
import { fmtPct } from "./format";

const last = (xs: number[]) => xs[xs.length - 1];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * วิเคราะห์เหรียญจากแท่งเทียนรายวัน (ควรมีอย่างน้อย ~210 แท่งเพื่อให้ EMA200 มีความหมาย)
 * คะแนน (Setup Score) วัดว่า "จังหวะเข้าตอนนี้ได้เปรียบแค่ไหน" ไม่ใช่โอกาสชนะที่รับประกัน
 */
export const MIN_CANDLES = 35;

export function analyze(symbol: string, candles: Candle[]): Analysis {
  const closes = candles.map((c) => c.c);
  const n = closes.length;
  const price = last(closes);
  // เหรียญใหม่ประวัติสั้น: ย่อรอบเส้นค่าเฉลี่ยลงตามข้อมูลที่มี
  const ema20 = last(ema(closes, Math.min(20, Math.floor(n / 2))));
  const ema50 = last(ema(closes, Math.min(50, Math.floor(n * 0.6))));
  const ema200 = last(ema(closes, Math.min(200, Math.floor(n * 0.85))));
  const rsiNow = last(rsi(closes));
  const atrNow = last(atr(candles));
  const hist = macdHistogram(closes);
  const macdHist = last(hist);
  const macdHistPrev = hist[hist.length - 2];
  const vols = candles.map((c) => c.v * c.c);
  const volRatio = mean(vols.slice(-7)) / (mean(vols.slice(-30)) || 1);
  const volatility = annualizedVolatility(closes);
  const change7d = (price / closes[closes.length - 8] - 1) * 100;
  const change30d = (price / closes[Math.max(0, n - 31)] - 1) * 100;
  const high90 = Math.max(...candles.slice(-90).map((c) => c.h));
  const fromHigh90d = (price / high90 - 1) * 100;
  const atrPct = (atrNow / price) * 100;
  const { supports, resistances } = supportResistance(candles, atrNow);

  const trend: Analysis["trend"] =
    price > ema200 && ema50 > ema200 ? "up" : price < ema200 && ema50 < ema200 ? "down" : "side";

  // จุดเข้า/ออกแบบไม้เดียว: SL ใต้แนวรับครึ่ง ATR (ไม่แคบกว่า 1 ATR และไม่กว้างกว่า 4 ATR)
  const s1 = supports[0];
  const stopLoss = clamp(s1 - 0.5 * atrNow, price - 4 * atrNow, price - 1 * atrNow);
  const takeProfit =
    resistances[0] - price >= 1.5 * atrNow ? resistances[0] : (resistances[1] ?? price + 3 * atrNow);
  const rrr = (takeProfit - price) / (price - stopLoss);

  // ---------- ให้คะแนน 6 ด้าน รวม 100 ----------
  // น้ำหนักมาจากการทดสอบย้อนหลัง 40 เหรียญ ~15,000 จุด (ดูหน้า "ความแม่นยำ")
  // ปัจจัยที่ทดสอบแล้วไม่ช่วยทำนาย (ใกล้แนวรับ, RSI โซนกลาง) ถูกตัดออกจากคะแนน แต่ยังแสดงเป็นข้อมูลประกอบ
  const factors: Factor[] = [];

  const stabPts = atrPct < 3 ? 25 : atrPct < 5 ? 18 : atrPct < 7 ? 10 : 0;
  factors.push({
    key: "stability",
    label: "ความนิ่ง",
    points: stabPts,
    max: 25,
    note: `แกว่งเฉลี่ยวันละ ${atrPct.toFixed(1)}% ${atrPct < 5 ? "— ควบคุมความเสี่ยงง่าย" : "— แกว่งแรง"}`,
  });

  const strengthPts = fromHigh90d > -5 ? 20 : fromHigh90d > -15 ? 14 : fromHigh90d > -30 ? 8 : 4;
  factors.push({
    key: "strength",
    label: "ความแข็งแรง",
    points: strengthPts,
    max: 20,
    note: fromHigh90d > -5 ? "ยืนใกล้จุดสูงสุด 90 วัน — ผู้ซื้อคุมเกม" : `ต่ำกว่าจุดสูงสุด 90 วัน ${Math.abs(fromHigh90d).toFixed(0)}%`,
  });

  let knifePts = 20;
  if (change30d < -20) knifePts -= 12;
  if (change7d < -10) knifePts -= 8;
  factors.push({
    key: "knife",
    label: "ไม่ใช่มีดตก",
    points: knifePts,
    max: 20,
    note: knifePts === 20 ? "ไม่ได้ร่วงหนักช่วงนี้" : `30 วัน ${fmtPct(change30d, 0)} · 7 วัน ${fmtPct(change7d, 0)} — กำลังร่วงแรง`,
  });

  const volPts = volRatio > 2 ? 15 : volRatio >= 0.7 ? 9 : 0;
  factors.push({
    key: "volume",
    label: "วอลุ่ม",
    points: volPts,
    max: 15,
    note: `วอลุ่ม 7 วัน = ${volRatio.toFixed(2)} เท่าของค่าเฉลี่ย 30 วัน${volRatio < 0.7 ? " — ตลาดเริ่มทิ้ง" : ""}`,
  });

  const momPts = rsiNow >= 50 ? 10 : 5;
  factors.push({
    key: "momentum",
    label: "โมเมนตัม",
    points: momPts,
    max: 10,
    note: `RSI ${rsiNow.toFixed(0)} ${rsiNow >= 50 ? "— ฝั่งซื้อได้เปรียบ" : "— ฝั่งขายได้เปรียบ"}`,
  });

  const trendPts = trend !== "down" ? 10 : 4;
  factors.push({
    key: "trend",
    label: "แนวโน้ม",
    points: trendPts,
    max: 10,
    note:
      trend === "up"
        ? "ยืนเหนือ EMA200 และ EMA50 ตัดขึ้น"
        : trend === "down"
          ? "อยู่ใต้ EMA200 — โครงสร้างขาลง"
          : "ราคาพันกับเส้น EMA — ยังไม่เลือกทาง",
  });

  const score = factors.reduce((a, f) => a + f.points, 0);

  const young = n < 180;
  let risk: Analysis["risk"] =
    volatility < 50 && trend === "up" ? "ต่ำ" : volatility < 80 ? "ปานกลาง" : volatility < 120 ? "สูง" : "สูงมาก";
  // เหรียญเพิ่งเข้าตลาดยังไม่ผ่านรอบขาลงจริง ถือว่าเสี่ยงอย่างน้อยระดับ "สูง"
  if (young && (risk === "ต่ำ" || risk === "ปานกลาง")) risk = "สูง";

  // ---------- สรุปภาษาเซียน ----------
  let tone: Analysis["verdict"]["tone"];
  let headline: string;
  const wild = risk === "สูง" || risk === "สูงมาก";
  if (score >= 75) {
    tone = "good";
    headline = wild
      ? "สัญญาณสวย แต่เหรียญนี้แกว่งแรง — สะสมได้ด้วยไม้เล็ก ตั้ง SL ทุกครั้ง"
      : "แข็งแรง นิ่ง และมีแรงซื้อ — จังหวะนี้ความเสี่ยงต่ำ น่าทยอยสะสม";
  } else if (score >= 60) {
    tone = "ok";
    headline = "ภาพรวมดี แต่ยังไม่ใช่จุดได้เปรียบที่สุด — เข้าไม้เล็ก รอย่อค่อยเติม";
  } else if (score >= 45) {
    tone = "wait";
    headline = "สัญญาณยังก้ำกึ่ง — ใจเย็น รอราคาเลือกทางก่อน";
  } else {
    tone = "bad";
    headline = "แนวโน้มยังไม่เป็นใจ — อย่ารับมีด รอสัญญาณกลับตัวก่อน";
  }

  const bullets: string[] = [];
  if (young) bullets.push(`เหรียญใหม่ มีข้อมูลแค่ ${n} วัน — สัญญาณยังเชื่อถือได้น้อย ใช้ไม้เล็กเท่านั้น`);
  if (rsiNow > 70) bullets.push(`RSI ${rsiNow.toFixed(0)} ร้อนแรงเกินไป ระวังแรงขายทำกำไร อย่าไล่ราคา`);
  else if (rsiNow < 30) bullets.push(`RSI ${rsiNow.toFixed(0)} อยู่โซน Oversold มีโอกาสเด้ง แต่ยังไม่ใช่สัญญาณกลับตัว`);
  if (trend === "down") bullets.push("ราคาอยู่ใต้ EMA200 รายวัน — ถ้าจะเล่นให้มองเป็นรอบสั้น ตั้ง SL เคร่งครัด");
  if (trend === "up" && price < ema20) bullets.push("ขาขึ้นใหญ่ยังอยู่ แต่ระยะสั้นกำลังพักตัว");
  const distToSupport = (price - s1) / atrNow;
  if (distToSupport <= 1.5) bullets.push(`ราคาอยู่ใกล้แนวรับ (${distToSupport.toFixed(1)} ATR) — ตั้ง SL ได้แคบ`);
  if (rrr >= 2) bullets.push(`Risk:Reward ${rrr.toFixed(1)} เท่า — คุ้มค่าความเสี่ยง`);
  else if (rrr < 1.2) bullets.push(`Risk:Reward แค่ ${rrr.toFixed(1)} เท่า — ราคาใกล้แนวต้าน ไม่คุ้มเสี่ยงตอนนี้`);
  if (volRatio > 1.3 && change7d > 0) bullets.push("วอลุ่มเข้ามาหนุนการขึ้น — มีเงินใหม่ไหลเข้า");
  if (volRatio > 1.3 && change7d < 0) bullets.push("วอลุ่มขายหนาผิดปกติ — ระวังแรงเทขายต่อเนื่อง");
  if (atrPct > 6) bullets.push(`แกว่งวันละ ~${atrPct.toFixed(1)}% — ลดขนาดไม้ และตั้ง SL ให้กว้างพอ`);
  if (fromHigh90d < -35) bullets.push(`ลงมาแล้ว ${fmtPct(fromHigh90d)} จากจุดสูงสุด 90 วัน`);
  if (bullets.length === 0) bullets.push("ไม่มีสัญญาณผิดปกติ — ยึดแผนและจุดตัดขาดทุนเป็นหลัก");

  return {
    symbol,
    price,
    historyDays: n,
    ema20,
    ema50,
    ema200,
    rsi: rsiNow,
    atr: atrNow,
    atrPct,
    macdHist,
    macdHistPrev,
    volRatio,
    volatility,
    change7d,
    change30d,
    fromHigh90d,
    supports,
    resistances,
    trend,
    score,
    factors,
    trade: { entry: price, stopLoss, takeProfit, rrr },
    risk,
    verdict: { tone, headline, bullets },
  };
}
