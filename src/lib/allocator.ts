import type { Analysis } from "./types";

export type Tranche = {
  key: "core" | "dip" | "breakout";
  label: string;
  desc: string;
  weight: number;
  amount: number; // บาท
  price: number; // ราคาที่ตั้งซื้อ
  qty: number; // จำนวนเหรียญหลังหักค่าธรรมเนียม
  orderType: string;
  distancePct: number; // % จากราคาปัจจุบัน
};

export type Scenario = {
  label: string;
  tranches: Tranche["key"][];
  invested: number;
  qty: number;
  avgCost: number;
  stopLoss: number;
  lossAtSL: number;
  lossPctOfCapital: number;
  profitTP1: number;
  profitTP2: number;
  rrr: number;
};

export type AllocationPlan = {
  capital: number;
  tranches: Tranche[];
  stopLoss: number;
  stopLossPct: number;
  trailStop: number; // SL ใหม่หลังไม้ 3 เข้า
  tp1: number;
  tp1Pct: number;
  tp2: number;
  tp2Pct: number;
  scenarios: Scenario[];
  worstLoss: number;
  worstLossPct: number;
  maxRiskPct: number;
  recommendedCapital: number; // ทุนสูงสุดที่ควรใช้กับแผนนี้เพื่อไม่ให้เสียเกินเพดาน
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * แบ่งไม้ 40/40/20
 * - ไม้ 1 Core Entry: ซื้อราคาตลาดทันที
 * - ไม้ 2 Deep Dip: ตั้ง Limit ที่แนวรับแรก
 * - ไม้ 3 Breakout: ซื้อเพิ่มเมื่อแท่งวันปิดเหนือแนวต้านแรก 1%
 * SL วางใต้ไม้ 2 หนึ่ง ATR (ให้พื้นที่ราคาแกว่งตามธรรมชาติ)
 */
export function buildPlan(
  capital: number,
  a: Pick<Analysis, "price" | "atr" | "supports" | "resistances">,
  feePct = 0.25,
  maxRiskPct = 5,
): AllocationPlan {
  const { price, atr } = a;
  const fee = feePct / 100;

  const dipPrice = clamp(a.supports[0], price - 4 * atr, price - 0.75 * atr);
  const breakoutPrice = a.resistances[0] * 1.01;
  const stopLoss = dipPrice - atr;
  const trailStop = a.resistances[0] - atr;
  const tp1 = Math.max(a.resistances[1] ?? 0, breakoutPrice + 2 * atr);
  const tp2 = price + (tp1 - price) * 1.618;

  const mk = (
    key: Tranche["key"],
    label: string,
    desc: string,
    weight: number,
    px: number,
    orderType: string,
  ): Tranche => {
    const amount = capital * weight;
    return {
      key,
      label,
      desc,
      weight,
      amount,
      price: px,
      qty: (amount * (1 - fee)) / px,
      orderType,
      distancePct: (px / price - 1) * 100,
    };
  };

  const tranches: Tranche[] = [
    mk("core", "ไม้ 1 · Core Entry", "ซื้อทันทีที่ราคาตลาด วางฐานพอร์ต", 0.4, price, "Market"),
    mk("dip", "ไม้ 2 · Deep Dip Support", "ตั้งรับที่แนวรับสำคัญ ถัวต้นทุนลง", 0.4, dipPrice, "Limit Buy"),
    mk(
      "breakout",
      "ไม้ 3 · Breakout Confirm",
      "ซื้อเพิ่มเมื่อแท่งวันปิดเหนือแนวต้าน ยืนยันขาขึ้น",
      0.2,
      breakoutPrice,
      "Stop Buy / รอปิดแท่ง",
    ),
  ];

  const byKey = Object.fromEntries(tranches.map((t) => [t.key, t])) as Record<Tranche["key"], Tranche>;

  const scenario = (label: string, keys: Tranche["key"][]): Scenario => {
    const ts = keys.map((k) => byKey[k]);
    const invested = ts.reduce((s, t) => s + t.amount, 0);
    const qty = ts.reduce((s, t) => s + t.qty, 0);
    // ถ้าไม้ Breakout เข้าแล้ว ให้เลื่อน SL ขึ้นมาใต้แนวต้านเดิม (ซึ่งกลายเป็นแนวรับ)
    const sl = keys.includes("breakout") ? trailStop : stopLoss;
    const exit = (px: number) => qty * px * (1 - fee) - invested;
    const lossAtSL = exit(sl);
    const profitTP1 = exit(tp1);
    return {
      label,
      tranches: keys,
      invested,
      qty,
      avgCost: invested / qty,
      stopLoss: sl,
      lossAtSL,
      lossPctOfCapital: (lossAtSL / capital) * 100,
      profitTP1,
      profitTP2: exit(tp2),
      rrr: lossAtSL < 0 ? profitTP1 / -lossAtSL : Infinity,
    };
  };

  const scenarios = [
    scenario("ได้แค่ไม้ 1 แล้วราคาร่วงถึง SL", ["core"]),
    scenario("ย่อมารับไม้ 2 ก่อน (แผนหลัก)", ["core", "dip"]),
    scenario("ไม่ย่อ พุ่งทะลุเลย (ไม้ 1 + 3)", ["core", "breakout"]),
    scenario("ครบทั้ง 3 ไม้", ["core", "dip", "breakout"]),
  ];

  const worstLoss = Math.min(...scenarios.map((s) => s.lossAtSL));
  const worstLossPct = (worstLoss / capital) * 100;
  const recommendedCapital =
    worstLossPct < 0 ? Math.min(capital, capital * (maxRiskPct / -worstLossPct)) : capital;

  return {
    capital,
    tranches,
    stopLoss,
    stopLossPct: (stopLoss / price - 1) * 100,
    trailStop,
    tp1,
    tp1Pct: (tp1 / price - 1) * 100,
    tp2,
    tp2Pct: (tp2 / price - 1) * 100,
    scenarios,
    worstLoss,
    worstLossPct,
    maxRiskPct,
    recommendedCapital,
  };
}
