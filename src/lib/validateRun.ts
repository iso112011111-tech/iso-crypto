import "server-only";
import { getCandles, getUniverse } from "./market";
import { cached, mapLimit } from "./http";
import { bucketize, samplesFor, type Sample } from "./validate";

/** ทดสอบ Setup Score ย้อนหลังกับเหรียญวอลุ่มสูงสุด N ตัว (แคช 6 ชม. เพราะคำนวณหนัก) */
export function runValidation(top: number, horizon: number) {
  return cached(`validate:${top}:${horizon}`, 6 * 3600_000, async () => {
    const u = await getUniverse();
    const perCoin = await mapLimit(u.coins.slice(0, top), 6, async (c) => {
      const { candles } = await getCandles(c.symbol, 1000, "1d");
      return { symbol: c.symbol, samples: samplesFor(candles, horizon) };
    });
    const ok = perCoin.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const all: Sample[] = ok.flatMap((r) => r.samples);
    return { ...bucketize(all), coins: ok.map((r) => r.symbol), samples: all.length, horizon, testedAt: Date.now() };
  });
}
