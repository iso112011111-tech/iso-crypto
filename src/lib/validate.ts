import type { Candle } from "./types";
import { analyze } from "./analyzer";

/**
 * ทดสอบความแม่นของ Setup Score ย้อนหลัง โดยไม่แอบดูอนาคต:
 * ณ วัน t ใช้ข้อมูลถึงวัน t เท่านั้นคำนวณคะแนน + จุด SL/TP
 * แล้วดูว่าภายใน `horizon` วันถัดไป ราคาแตะ TP ก่อน (ชนะ) หรือ SL ก่อน (แพ้)
 */
export type Sample = { score: number; ret: number; outcome: "win" | "loss" | "open"; rrr: number };

export function samplesFor(candles: Candle[], horizon = 30, step = 3, warmup = 210): Sample[] {
  const out: Sample[] = [];
  for (let t = warmup; t < candles.length - horizon - 1; t += step) {
    const a = analyze("", candles.slice(0, t + 1));
    const { entry, stopLoss, takeProfit, rrr } = a.trade;
    let outcome: Sample["outcome"] = "open";
    for (let k = t + 1; k <= t + horizon; k++) {
      const c = candles[k];
      const hitSL = c.l <= stopLoss;
      const hitTP = c.h >= takeProfit;
      // ถ้าแตะทั้งคู่ในแท่งเดียว ถือว่าแพ้ไว้ก่อน (มองแบบระวัง)
      if (hitSL) {
        outcome = "loss";
        break;
      }
      if (hitTP) {
        outcome = "win";
        break;
      }
    }
    out.push({ score: a.score, ret: (candles[t + horizon].c / entry - 1) * 100, outcome, rrr });
  }
  return out;
}

export type Bucket = {
  label: string;
  min: number;
  max: number;
  n: number;
  winRate: number | null; // ชนะ ÷ (ชนะ + แพ้)
  avgRet: number | null; // ผลตอบแทนเฉลี่ยถ้าถือครบ horizon
  medianRet: number | null;
  positive: number | null; // % ครั้งที่ถือครบแล้วกำไร
  expectancy: number | null; // กำไรเฉลี่ยต่อ 1R ที่เสี่ยง
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function bucketize(samples: Sample[]): { buckets: Bucket[]; baseline: Bucket } {
  const ranges = [
    { label: "75–100 (น่าสะสม)", min: 75, max: 101 },
    { label: "60–74 (ทยอยได้)", min: 60, max: 75 },
    { label: "45–59 (รอดูก่อน)", min: 45, max: 60 },
    { label: "0–44 (ยังไม่ใช่)", min: 0, max: 45 },
  ];
  const stat = (label: string, min: number, max: number, xs: Sample[]): Bucket => {
    const decided = xs.filter((x) => x.outcome !== "open");
    const wins = decided.filter((x) => x.outcome === "win");
    const winRate = decided.length ? wins.length / decided.length : null;
    const avgR = wins.length ? wins.reduce((s, x) => s + x.rrr, 0) / wins.length : 0;
    return {
      label,
      min,
      max,
      n: xs.length,
      winRate,
      avgRet: xs.length ? xs.reduce((s, x) => s + x.ret, 0) / xs.length : null,
      medianRet: median(xs.map((x) => x.ret)),
      positive: xs.length ? xs.filter((x) => x.ret > 0).length / xs.length : null,
      expectancy: winRate != null ? winRate * avgR - (1 - winRate) : null,
    };
  };
  return {
    buckets: ranges.map((r) => stat(r.label, r.min, r.max, samples.filter((s) => s.score >= r.min && s.score < r.max))),
    baseline: stat("ทุกจังหวะ (สุ่มเข้า)", 0, 101, samples),
  };
}
