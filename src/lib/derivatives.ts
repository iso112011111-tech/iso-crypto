import "server-only";
import { cached, getJSON } from "./http";
import type { Derivatives } from "./types";

/**
 * ข้อมูลตลาดฟิวเจอร์ส: Funding Rate, Open Interest, สัดส่วน Long/Short
 * ใช้ดูว่าตลาด "เลเวอเรจหนักเกินไป" หรือยัง ซึ่งมักนำไปสู่การล้างพอร์ตแรง ๆ
 */
const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const safe = <T,>(p: Promise<T>) => p.catch(() => null);

export async function getDerivatives(symbol: string, change7d: number | null): Promise<Derivatives | null> {
  const s = symbol.toUpperCase();
  return cached(`deriv:${s}`, 5 * 60_000, async () => {
    const [bnPremium, bnOi, bnLsr, bybit, okx] = await Promise.all([
      safe(getJSON<{ lastFundingRate: string }>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${s}USDT`)),
      safe(getJSON<{ sumOpenInterestValue: string }[]>(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${s}USDT&period=1d&limit=30`)),
      safe(getJSON<{ longShortRatio: string }[]>(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${s}USDT&period=1d&limit=30`)),
      safe(getJSON<{ result: { list: { fundingRate: string; openInterestValue: string }[] } }>(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}USDT`)),
      safe(getJSON<{ data: { fundingRate: string }[] }>(`https://www.okx.com/api/v5/public/funding-rate?instId=${s}-USDT-SWAP`)),
    ]);

    const funding: Derivatives["funding"] = [];
    const bnF = num(bnPremium?.lastFundingRate);
    if (bnF != null) funding.push({ ex: "Binance", rate: bnF * 100 });
    const byRow = bybit?.result?.list?.[0];
    const byF = num(byRow?.fundingRate);
    if (byF != null) funding.push({ ex: "Bybit", rate: byF * 100 });
    const okF = num(okx?.data?.[0]?.fundingRate);
    if (okF != null) funding.push({ ex: "OKX", rate: okF * 100 });

    const oiHistory = Array.isArray(bnOi) ? bnOi.map((x) => num(x.sumOpenInterestValue) ?? 0).filter((x) => x > 0) : [];
    const lsHistory = Array.isArray(bnLsr) ? bnLsr.map((x) => num(x.longShortRatio) ?? 0).filter((x) => x > 0) : [];
    if (!funding.length && !oiHistory.length) return null; // ไม่มีฟิวเจอร์สให้เทรด

    const fundingAvg = funding.length ? funding.reduce((a, f) => a + f.rate, 0) / funding.length : null;
    const oiNow = oiHistory.at(-1) ?? num(byRow?.openInterestValue);
    const oi7 = oiHistory.length >= 8 ? oiHistory[oiHistory.length - 8] : null;
    const oiChange7d = oiNow && oi7 ? (oiNow / oi7 - 1) * 100 : null;
    const longShort = lsHistory.at(-1) ?? null;

    // ---------- แปลความหมายเป็นภาษาคน ----------
    const notes: Derivatives["notes"] = [];
    if (fundingAvg != null) {
      if (fundingAvg > 0.05) notes.push({ tone: "bad", text: "Funding สูงมาก — ฝั่ง Long จ่ายแพง เลเวอเรจล้นฝั่งซื้อ ระวังโดนล้างพอร์ตลงแรง" });
      else if (fundingAvg > 0.02) notes.push({ tone: "warn", text: "Funding เริ่มร้อน — คนเปิด Long เยอะ อย่าไล่ราคา" });
      else if (fundingAvg < -0.02) notes.push({ tone: "good", text: "Funding ติดลบ — Short แน่น ถ้าราคาขึ้นอาจเกิด Short Squeeze ดีดแรง" });
      else notes.push({ tone: "info", text: "Funding ปกติ — ยังไม่มีฝั่งไหนใช้เลเวอเรจมากเกินไป" });
    }
    if (oiChange7d != null && change7d != null) {
      if (oiChange7d > 15 && change7d > 0) notes.push({ tone: "good", text: `OI เพิ่ม ${oiChange7d.toFixed(0)}% พร้อมราคาขึ้น — เงินใหม่เข้าหนุนขาขึ้น` });
      else if (oiChange7d > 15 && change7d < 0) notes.push({ tone: "warn", text: `OI เพิ่ม ${oiChange7d.toFixed(0)}% แต่ราคาลง — มีคนเปิด Short เพิ่ม แรงกดดันฝั่งขาย` });
      else if (oiChange7d < -15 && change7d > 0) notes.push({ tone: "warn", text: "ราคาขึ้นแต่ OI ลด — ขึ้นเพราะ Short ปิดสถานะ แรงอาจไม่ยั่งยืน" });
      else if (oiChange7d < -15 && change7d < 0) notes.push({ tone: "info", text: "OI ลดพร้อมราคาลง — Long ถูกล้าง/ปิดสถานะ ตลาดกำลังล้างเลเวอเรจ" });
    }
    if (longShort != null) {
      if (longShort > 2) notes.push({ tone: "warn", text: `บัญชี Long มากกว่า Short ${longShort.toFixed(1)} เท่า — รายย่อยแห่ซื้อ มักเป็นสัญญาณกลับด้าน` });
      else if (longShort < 0.8) notes.push({ tone: "good", text: `บัญชี Short มากกว่า Long — รายย่อยกลัว มักเป็นจังหวะที่ราคาดีดสวน` });
    }

    return { fundingAvg, funding, oiUsd: oiNow ?? null, oiChange7d, oiHistory, longShort, longShortHistory: lsHistory, notes };
  });
}
