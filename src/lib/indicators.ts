import type { Candle } from "./types";

/** Exponential Moving Average — ค่าก่อนครบรอบจะเป็น NaN, เริ่มต้นด้วย SMA */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI แบบ Wilder */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Average True Range แบบ Wilder — ใช้วัดว่าเหรียญแกว่งวันละกี่บาท */
export function atr(candles: Candle[], period = 14): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  if (candles.length <= period) return out;
  const tr = candles.map((c, i) =>
    i === 0
      ? c.h - c.l
      : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c)),
  );
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** MACD histogram (12, 26, 9) */
export function macdHistogram(closes: number[]): number[] {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = closes.map((_, i) => fast[i] - slow[i]);
  const firstValid = line.findIndex((v) => !Number.isNaN(v));
  const signal = new Array<number>(closes.length).fill(NaN);
  if (firstValid >= 0) {
    const s = ema(line.slice(firstValid), 9);
    s.forEach((v, i) => (signal[firstValid + i] = v));
  }
  return line.map((v, i) => v - signal[i]);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** ความผันผวนรายปี (%) จาก log return รายวัน */
export function annualizedVolatility(closes: number[], lookback = 30): number {
  const slice = closes.slice(-lookback - 1);
  const rets = slice.slice(1).map((c, i) => Math.log(c / slice[i]));
  const m = mean(rets);
  const variance = mean(rets.map((r) => (r - m) ** 2));
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

/**
 * หาแนวรับ/แนวต้านจากจุดกลับตัว (swing high/low) แล้วรวมระดับที่ใกล้กันเป็นโซนเดียว
 * โซนไหนราคาเคยมาแตะหลายครั้งจะถือว่าแข็งแรงกว่า
 */
export function supportResistance(candles: Candle[], atrValue: number, lookback = 180, wing = 3) {
  const data = candles.slice(-lookback);
  const price = data[data.length - 1].c;
  const pivots: number[] = [];
  for (let i = wing; i < data.length - wing; i++) {
    const win = data.slice(i - wing, i + wing + 1);
    if (win.every((c) => c.l >= data[i].l)) pivots.push(data[i].l);
    if (win.every((c) => c.h <= data[i].h)) pivots.push(data[i].h);
  }

  // รวมจุดที่ห่างกันไม่เกิน 0.6 ATR เป็นโซนเดียวกัน
  const sorted = [...pivots].sort((a, b) => a - b);
  const zones: { level: number; touches: number }[] = [];
  for (const p of sorted) {
    const last = zones[zones.length - 1];
    if (last && p - last.level <= atrValue * 0.6) {
      last.level = (last.level * last.touches + p) / (last.touches + 1);
      last.touches++;
    } else zones.push({ level: p, touches: 1 });
  }

  const gap = atrValue * 0.5;
  const supports = zones
    .filter((z) => z.level < price - gap)
    .sort((a, b) => b.level - a.level)
    .map((z) => z.level);
  const resistances = zones
    .filter((z) => z.level > price + gap)
    .sort((a, b) => a.level - b.level)
    .map((z) => z.level);

  // กันกรณีราคาทำจุดสูงสุด/ต่ำสุดใหม่จนไม่มีโซนเหลือ
  if (supports.length === 0) supports.push(Math.min(...data.slice(-30).map((c) => c.l), price - 2 * atrValue));
  if (resistances.length === 0) resistances.push(Math.max(...data.slice(-30).map((c) => c.h), price + 2 * atrValue));
  if (supports.length === 1) supports.push(supports[0] - 2 * atrValue);
  if (resistances.length === 1) resistances.push(resistances[0] + 2 * atrValue);

  return { supports: supports.slice(0, 3), resistances: resistances.slice(0, 3) };
}

/**
 * ใส่ราคาสดลงแท่งเทียนล่าสุด (แท่งวันนี้ที่ยังไม่ปิด) เพื่อให้การวิเคราะห์ใช้ราคาปัจจุบันจริง
 * แม้ประวัติแท่งเทียนจะถูกแคชไว้ — ถ้าแท่งล่าสุดเก่ากว่ารอบเวลา จะเพิ่มแท่งใหม่ให้
 */
export function withLivePrice(candles: Candle[], price: number | null | undefined, periodMs = 86_400_000): Candle[] {
  if (!price || !Number.isFinite(price) || candles.length === 0) return candles;
  const last = candles[candles.length - 1];
  const now = Date.now();
  if (now < last.t + periodMs) {
    return [...candles.slice(0, -1), { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) }];
  }
  if (now - last.t < 3 * periodMs) {
    const t = last.t + periodMs * Math.floor((now - last.t) / periodMs);
    return [...candles, { t, o: last.c, h: Math.max(last.c, price), l: Math.min(last.c, price), c: price, v: 0 }];
  }
  return candles;
}
