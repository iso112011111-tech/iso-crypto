import type { Candle } from "./types";
import { rsi } from "./indicators";

export type CurvePoint = { t: number; value: number; invested: number };

export type StrategyResult = {
  key: "lump" | "dca" | "smart";
  label: string;
  desc: string;
  invested: number;
  qty: number;
  value: number;
  pnl: number;
  roi: number;
  avgCost: number;
  maxDrawdown: number; // % ต่ำสุดของ (มูลค่า/เงินลงทุน - 1)
  buys: number;
  curve: CurvePoint[];
};

/** ตัวคูณของ Smart DCA: ช่วงตลาดกลัว (RSI ต่ำ) ซื้อหนัก ช่วงตลาดร้อนแรงซื้อเบา */
export function smartMultiplier(rsiValue: number): number {
  if (!Number.isFinite(rsiValue)) return 1;
  if (rsiValue < 30) return 2;
  if (rsiValue < 45) return 1.5;
  if (rsiValue > 70) return 0.5;
  return 1;
}

/**
 * ทดสอบย้อนหลังด้วยราคาปิดรายวันจริง
 * @param candles แท่งเทียนทั้งหมด (ควรมากกว่า days เล็กน้อยเพื่อให้ RSI อุ่นเครื่อง)
 * @param days จำนวนวันย้อนหลังที่ทดสอบ
 * @param amount เงินต่อครั้งของ DCA (บาท)
 * @param everyDays ซื้อทุกกี่วัน
 */
export function runBacktest(
  candles: Candle[],
  days: number,
  amount: number,
  everyDays: number,
  feePct = 0.25,
): StrategyResult[] {
  const fee = feePct / 100;
  const rsiAll = rsi(candles.map((c) => c.c));
  const start = Math.max(0, candles.length - days);
  const window = candles.slice(start);
  const rsiWin = rsiAll.slice(start);

  const buyDays = window.map((_, i) => i % everyDays === 0);
  const dcaBudget = buyDays.filter(Boolean).length * amount;

  const simulate = (
    key: StrategyResult["key"],
    label: string,
    desc: string,
    spend: (i: number) => number,
  ): StrategyResult => {
    let invested = 0;
    let qty = 0;
    let buys = 0;
    let maxDrawdown = 0;
    const curve: CurvePoint[] = [];
    window.forEach((c, i) => {
      const s = spend(i);
      if (s > 0) {
        invested += s;
        qty += (s * (1 - fee)) / c.c;
        buys++;
      }
      const value = qty * c.c;
      if (invested > 0) maxDrawdown = Math.min(maxDrawdown, (value / invested - 1) * 100);
      curve.push({ t: c.t, value, invested });
    });
    const value = qty * window[window.length - 1].c * (1 - fee);
    return {
      key,
      label,
      desc,
      invested,
      qty,
      value,
      pnl: value - invested,
      roi: invested ? (value / invested - 1) * 100 : 0,
      avgCost: qty ? invested / qty : 0,
      maxDrawdown,
      buys,
      curve,
    };
  };

  return [
    simulate("lump", "ทุ่มก้อนเดียว", "ใช้งบเท่า DCA ซื้อทั้งหมดวันแรก", (i) => (i === 0 ? dcaBudget : 0)),
    simulate("dca", "DCA ปกติ", `ซื้อ ฿${amount.toLocaleString("th-TH")} ทุก ${everyDays} วัน`, (i) =>
      buyDays[i] ? amount : 0,
    ),
    simulate("smart", "Smart DCA", "ซื้อ 2 เท่าเมื่อ RSI<30, 1.5 เท่าเมื่อ <45, ครึ่งเดียวเมื่อ >70", (i) =>
      buyDays[i] ? amount * smartMultiplier(rsiWin[i]) : 0,
    ),
  ];
}
