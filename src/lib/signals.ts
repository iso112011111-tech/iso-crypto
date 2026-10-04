import type { Candle, Flow, MultiTimeframe, TimeframeRow } from "./types";
import { ema, mean, rsi } from "./indicators";

const last = (xs: number[]) => xs[xs.length - 1];

/** รวมแท่งรายวันเป็นรายสัปดาห์ (เริ่มสัปดาห์วันจันทร์ ตามเวลา UTC) */
export function toWeekly(daily: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const c of daily) {
    const d = new Date(c.t);
    const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const w = out[out.length - 1];
    if (w && w.t === monday) {
      w.h = Math.max(w.h, c.h);
      w.l = Math.min(w.l, c.l);
      w.c = c.c;
      w.v += c.v;
    } else out.push({ t: monday, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
  }
  return out;
}

function trendOf(candles: Candle[], tf: TimeframeRow["tf"]): TimeframeRow | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.c);
  const price = last(closes);
  const fast = last(ema(closes, 20));
  const slow = last(ema(closes, Math.min(50, Math.floor(closes.length * 0.8))));
  const r = last(rsi(closes));
  const trend: TimeframeRow["trend"] = price > fast && fast > slow ? "up" : price < fast && fast < slow ? "down" : "side";
  const note =
    trend === "up"
      ? r > 70 ? "ขาขึ้น แต่ร้อนแรง" : "ขาขึ้น"
      : trend === "down"
        ? r < 30 ? "ขาลง ขายมากเกินไป" : "ขาลง"
        : "ไซด์เวย์";
  return { tf, trend, rsi: r, note };
}

/**
 * เช็คแนวโน้ม 3 กรอบเวลา: 4 ชม. (ระยะสั้น), รายวัน (หลัก), รายสัปดาห์ (ภาพใหญ่)
 * ถ้าทุกกรอบชี้ทางเดียวกัน สัญญาณมีน้ำหนักกว่ามาก
 */
export function multiTimeframe(h4: Candle[], daily: Candle[]): MultiTimeframe | null {
  const rows = [trendOf(h4, "4H"), trendOf(daily, "1D"), trendOf(toWeekly(daily), "1W")].filter((r): r is TimeframeRow => !!r);
  if (rows.length < 2) return null;
  const up = rows.filter((r) => r.trend === "up").length;
  const down = rows.filter((r) => r.trend === "down").length;
  const aligned = Math.max(up, down);
  const n = rows.length;
  let summary: string;
  if (up === n) summary = "ทุกกรอบเวลาเป็นขาขึ้น — สัญญาณแข็งแรง";
  else if (down === n) summary = "ทุกกรอบเวลาเป็นขาลง — หลีกเลี่ยงการสวนเทรนด์";
  else if (rows.find((r) => r.tf === "1W")?.trend === "up" && rows.find((r) => r.tf === "4H")?.trend !== "up")
    summary = "ภาพใหญ่ขาขึ้น ระยะสั้นกำลังพักตัว — มักเป็นจังหวะย่อให้สะสม";
  else if (rows.find((r) => r.tf === "1W")?.trend === "down" && rows.find((r) => r.tf === "4H")?.trend === "up")
    summary = "ระยะสั้นเด้งขึ้นในภาพใหญ่ขาลง — ระวังเป็นแค่การรีบาวด์";
  else if (up >= 2 && down === 0) summary = `ขาขึ้น ${up} ใน ${n} กรอบเวลา ที่เหลือไซด์เวย์ — ค่อนข้างดี รอกรอบที่เหลือยืนยัน`;
  else if (down >= 2 && up === 0) summary = `ขาลง ${down} ใน ${n} กรอบเวลา — ระวัง อย่าเพิ่งรีบรับ`;
  else summary = "กรอบเวลาขัดแย้งกัน — สัญญาณยังไม่ชัด รอให้สอดคล้องก่อน";
  return { rows, aligned, summary };
}

/** แรงซื้อขายและวอลุ่มผิดปกติ */
export function flowOf(daily: Candle[], dex?: { buys: number; sells: number }): Flow {
  const notes: string[] = [];
  // ใช้วันล่าสุดที่ปิดแท่งแล้ว (แท่งสุดท้ายยังไม่จบวัน)
  const done = daily.slice(0, -1);
  const vols = done.map((c) => c.v * c.c);
  const prev20 = vols.slice(-21, -1);
  const volSpike = prev20.length >= 10 ? (last(vols) ?? 0) / (mean(prev20) || 1) : null;
  if (volSpike != null) {
    if (volSpike >= 3) notes.push(`วอลุ่มเมื่อวานพุ่ง ${volSpike.toFixed(1)} เท่าของปกติ — มีเงินก้อนใหญ่/ข่าวเข้า`);
    else if (volSpike < 0.5) notes.push("วอลุ่มเงียบผิดปกติ — ตลาดไม่สนใจ ราคามักเคลื่อนช้า");
  }

  const ratio = (n: number) => {
    const xs = done.slice(-n).filter((c) => c.tb != null && c.v > 0);
    if (xs.length < Math.min(n, 5)) return null;
    return xs.reduce((s, c) => s + c.tb!, 0) / xs.reduce((s, c) => s + c.v, 0);
  };
  const takerBuy7d = ratio(7);
  const takerBuy30d = ratio(30);
  if (takerBuy7d != null) {
    if (takerBuy7d > 0.53) notes.push(`7 วันที่ผ่านมาฝั่งกดซื้อ market ชนะ (${(takerBuy7d * 100).toFixed(0)}%) — แรงซื้อเชิงรุก`);
    else if (takerBuy7d < 0.47) notes.push(`7 วันที่ผ่านมาฝั่งกดขาย market ชนะ (${((1 - takerBuy7d) * 100).toFixed(0)}%) — มีคนทยอยเทขาย`);
  }

  if (dex) {
    const total = dex.buys + dex.sells;
    if (total > 20) {
      const b = dex.buys / total;
      if (b > 0.6) notes.push(`24 ชม. มีธุรกรรมซื้อ ${(b * 100).toFixed(0)}% — คนไล่ซื้อบน DEX`);
      else if (b < 0.4) notes.push(`24 ชม. มีธุรกรรมขาย ${((1 - b) * 100).toFixed(0)}% — คนเทขายบน DEX`);
    }
  }
  if (!notes.length) notes.push("แรงซื้อขายสมดุล ไม่มีความผิดปกติ");

  return { volSpike, takerBuy7d, takerBuy30d, dexBuys24h: dex?.buys, dexSells24h: dex?.sells, notes };
}
