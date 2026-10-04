import "server-only";
import { cached, getJSON, mapLimit } from "./http";
import { getUniverse } from "./market";
import { getStore } from "./store";
import { isJunkSymbol } from "./coins";
import { EXCHANGES } from "./exchanges";
import type { ExchangeId, MarketCoin } from "./types";

/* ============================ เรดาร์ฟิวเจอร์สทั้งตลาด ============================ */

export type FuturesRow = {
  symbol: string;
  name?: string;
  image?: string;
  price: number | null; // THB
  change24h: number; // %
  fundingPct: number; // % ต่อ 8 ชม. (เฉลี่ย Binance + Bybit)
  oiUsd: number;
  oiChange24h: number | null;
  turnoverUsd: number;
  tag?: string;
};

export type FuturesRadar = {
  hotFunding: FuturesRow[];
  negativeFunding: FuturesRow[];
  oiSurge: FuturesRow[];
  squeeze: FuturesRow[];
  marketFundingAvg: number;
  scanned: number;
  updatedAt: number;
};

type BybitTicker = { symbol: string; lastPrice: string; fundingRate: string; openInterestValue: string; turnover24h: string; price24hPcnt: string };

export function getFuturesRadar(): Promise<FuturesRadar> {
  return cached("radar:futures", 5 * 60_000, async () => {
    const [bybit, binance, u] = await Promise.all([
      getJSON<{ result: { list: BybitTicker[] } }>("https://api.bybit.com/v5/market/tickers?category=linear").then((d) => d.result.list),
      getJSON<{ symbol: string; lastFundingRate: string }[]>("https://fapi.binance.com/fapi/v1/premiumIndex").catch(() => []),
      getUniverse(),
    ]);
    const bnFunding = new Map(binance.map((x) => [x.symbol, parseFloat(x.lastFundingRate)]));

    let rows: FuturesRow[] = bybit
      .filter((t) => t.symbol.endsWith("USDT"))
      .map((t) => {
        const base = t.symbol.slice(0, -4).replace(/^1000+/, ""); // 1000PEPE → PEPE
        const fr = [parseFloat(t.fundingRate), bnFunding.get(t.symbol)].filter((x): x is number => x != null && Number.isFinite(x));
        const m = u.bySymbol.get(base);
        return {
          symbol: base,
          name: m?.th ?? m?.name,
          image: m?.image,
          price: m?.price ?? null,
          change24h: parseFloat(t.price24hPcnt) * 100,
          fundingPct: fr.length ? (fr.reduce((a, b) => a + b, 0) / fr.length) * 100 : 0,
          oiUsd: parseFloat(t.openInterestValue),
          oiChange24h: null,
          turnoverUsd: parseFloat(t.turnover24h),
        };
      })
      // ตัดเหรียญสภาพคล่องต่ำ: ค่า funding ของเหรียญเล็กมักแกว่งไร้ความหมาย
      .filter((r) => r.oiUsd > 2_000_000 && r.turnoverUsd > 5_000_000 && !isJunkSymbol(r.symbol));

    // OI เปลี่ยนใน 24 ชม. — ดึงเฉพาะ 40 อันดับ OI สูงสุด (ทีละเหรียญ)
    const top = [...rows].sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 40);
    const hist = await mapLimit(top, 8, async (r) => {
      const sym = bybit.find((t) => t.symbol.slice(0, -4).replace(/^1000+/, "") === r.symbol)?.symbol ?? `${r.symbol}USDT`;
      const d = await getJSON<{ result: { list: { openInterest: string }[] } }>(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}&intervalTime=1h&limit=25`);
      const l = d.result.list;
      return l.length >= 25 ? (parseFloat(l[0].openInterest) / parseFloat(l[24].openInterest) - 1) * 100 : null;
    });
    top.forEach((r, i) => {
      const h = hist[i];
      r.oiChange24h = h.status === "fulfilled" ? h.value : null;
    });
    const oiMap = new Map(top.map((r) => [r.symbol, r.oiChange24h]));
    rows = rows.map((r) => ({ ...r, oiChange24h: oiMap.get(r.symbol) ?? null }));

    const byFunding = [...rows].sort((a, b) => b.fundingPct - a.fundingPct);
    const squeeze = rows
      .filter((r) => r.fundingPct < -0.005 && (r.oiChange24h ?? 0) > 5 && r.change24h > 0)
      .sort((a, b) => a.fundingPct - b.fundingPct)
      .map((r) => ({ ...r, tag: "Short แน่น + OI เพิ่ม + ราคาเริ่มขึ้น" }));

    return {
      hotFunding: byFunding.slice(0, 12).map((r) => ({ ...r, tag: r.fundingPct > 0.05 ? "Long จ่ายแพงมาก เสี่ยงโดนล้าง" : "ฝั่ง Long หนาแน่น" })),
      negativeFunding: byFunding.slice(-12).reverse().map((r) => ({ ...r, tag: "Short จ่าย Long — คนเล่นขาลงเยอะ" })),
      oiSurge: top
        .filter((r) => r.oiChange24h != null)
        .sort((a, b) => Math.abs(b.oiChange24h!) - Math.abs(a.oiChange24h!))
        .slice(0, 12)
        .map((r) => ({
          ...r,
          tag:
            (r.oiChange24h ?? 0) > 0
              ? r.change24h > 0
                ? "เงินใหม่เข้าหนุนขาขึ้น"
                : "เปิด Short เพิ่ม แรงกดฝั่งขาย"
              : r.change24h > 0
                ? "ขึ้นเพราะ Short ปิด (แรงอาจไม่ยั่งยืน)"
                : "Long ถูกล้าง/ปิดสถานะ",
        })),
      squeeze: squeeze.slice(0, 10),
      marketFundingAvg: rows.length ? rows.reduce((a, r) => a + r.fundingPct, 0) / rows.length : 0,
      scanned: rows.length,
      updatedAt: Date.now(),
    };
  });
}

/* ============================ เรดาร์เหรียญเข้ากระดานใหม่ ============================ */

export type Listing = {
  symbol: string;
  ex: ExchangeId;
  exName: string;
  listedAt: number;
  source: "official" | "detected"; // วันที่จากกระดานเอง หรือระบบเราเห็นเป็นครั้งแรก
  market: Pick<MarketCoin, "name" | "th" | "image" | "price" | "change24h" | "quoteVolume" | "rank"> & { exchanges: number; onThai: boolean } | null;
};

type Seen = Record<string, Record<string, number>>; // ex → symbol → เห็นครั้งแรก (0 = มีอยู่ก่อนเริ่มจับ)

/** เทียบรายชื่อเหรียญแต่ละกระดานกับครั้งก่อน เพื่อจับเหรียญที่เพิ่งเข้ามาใหม่ (เรียกจากตัวตั้งเวลา/ตอนเปิดหน้า) */
export async function trackListings() {
  const u = await getUniverse();
  const store = getStore();
  const seen = (await store.get<Seen>("listing:seen")) ?? {};
  const now = Date.now();
  let changed = false;
  const byEx = new Map<string, Set<string>>();
  for (const c of u.coins) for (const q of c.exchanges) byEx.set(q.ex, (byEx.get(q.ex) ?? new Set()).add(c.symbol));
  for (const [ex, syms] of byEx) {
    const first = !seen[ex]; // กระดานนี้เพิ่งเริ่มจับ → ถือว่าทุกเหรียญมีอยู่ก่อนแล้ว
    seen[ex] ??= {};
    for (const s of syms)
      if (!(s in seen[ex])) {
        seen[ex][s] = first ? 0 : now;
        changed = true;
      }
  }
  if (changed) await store.set("listing:seen", seen);
  return seen;
}

type OkxInst = { instId: string; baseCcy: string; quoteCcy: string; listTime: string; state: string };
type GatePair = { base: string; quote: string; trade_status: string; buy_start?: number };

export function getListings(days = 45): Promise<{ rows: Listing[]; trackingSince: number | null; updatedAt: number }> {
  return cached(`radar:listings:${days}`, 10 * 60_000, async () => {
    const since = Date.now() - days * 86_400_000;
    const [u, okx, gate, seen] = await Promise.all([
      getUniverse(),
      getJSON<{ data: OkxInst[] }>("https://www.okx.com/api/v5/public/instruments?instType=SPOT").then((d) => d.data).catch(() => [] as OkxInst[]),
      getJSON<GatePair[]>("https://api.gateio.ws/api/v4/spot/currency_pairs", 15000).catch(() => [] as GatePair[]),
      trackListings(),
    ]);

    const raw: Omit<Listing, "market" | "exName">[] = [];
    for (const i of okx) if (i.quoteCcy === "USDT" && i.state === "live" && +i.listTime > since) raw.push({ symbol: i.baseCcy.toUpperCase(), ex: "okx", listedAt: +i.listTime, source: "official" });
    for (const p of gate)
      if (p.quote === "USDT" && p.trade_status === "tradable" && (p.buy_start ?? 0) * 1000 > since) raw.push({ symbol: p.base.toUpperCase(), ex: "gate", listedAt: p.buy_start! * 1000, source: "official" });
    // กระดานที่ไม่บอกวันลิสต์ ใช้วันที่ระบบเราเห็นเหรียญครั้งแรก
    for (const [ex, syms] of Object.entries(seen))
      for (const [s, t] of Object.entries(syms))
        if (t > since && ex !== "okx" && ex !== "gate") raw.push({ symbol: s, ex: ex as ExchangeId, listedAt: t, source: "detected" });
    let trackingSince = await getStore().get<number>("listing:start");
    if (!trackingSince) {
      trackingSince = Date.now();
      await getStore().set("listing:start", trackingSince);
    }

    const rows = raw
      .filter((r) => !isJunkSymbol(r.symbol))
      .map((r): Listing => {
        const m = u.bySymbol.get(r.symbol);
        return {
          ...r,
          exName: EXCHANGES[r.ex].name,
          market: m
            ? {
                name: m.name,
                th: m.th,
                image: m.image,
                price: m.price,
                change24h: m.change24h,
                quoteVolume: m.quoteVolume,
                rank: m.rank,
                exchanges: m.exchanges.length,
                onThai: m.exchanges.some((e) => e.ex === "bitkub" || e.ex === "binanceth") || !!m.onBinanceTH,
              }
            : null,
        };
      })
      .filter((r) => r.market) // ต้องยังมีการซื้อขายจริง
      .sort((a, b) => b.listedAt - a.listedAt);
    return { rows, trackingSince, updatedAt: Date.now() };
  });
}

/* ============================ ส่วนต่างราคาไทย vs โลก ============================ */

export type PremiumRow = {
  symbol: string;
  name?: string;
  image?: string;
  ex: "bitkub" | "binanceth";
  exName: string;
  thaiPrice: number;
  globalPrice: number;
  premiumPct: number;
  netPct: number; // หลังหักค่าธรรมเนียมซื้อ+ขาย ~0.5% (ยังไม่รวมค่าถอน/ค่าโอน)
  thaiVolume: number; // THB
};

export async function getPremiums(): Promise<{ rows: PremiumRow[]; avgBitkub: number | null; updatedAt: number }> {
  const u = await getUniverse();
  const rows: PremiumRow[] = [];
  for (const c of u.coins) {
    const global = c.exchanges.find((e) => e.ex !== "bitkub" && e.ex !== "binanceth");
    if (!global) continue;
    for (const ex of ["bitkub", "binanceth"] as const) {
      const q = c.exchanges.find((e) => e.ex === ex);
      if (!q || q.volume < 100_000) continue; // วอลุ่มต่ำ = ราคาไม่สะท้อนจริง
      const premiumPct = (q.price / global.price - 1) * 100;
      rows.push({
        symbol: c.symbol,
        name: c.th ?? c.name,
        image: c.image,
        ex,
        exName: EXCHANGES[ex].name,
        thaiPrice: q.price,
        globalPrice: global.price,
        premiumPct,
        netPct: Math.sign(premiumPct) * Math.max(0, Math.abs(premiumPct) - 0.5),
        thaiVolume: q.volume,
      });
    }
  }
  const bk = rows.filter((r) => r.ex === "bitkub" && r.thaiVolume > 1_000_000);
  return {
    rows: rows.sort((a, b) => Math.abs(b.premiumPct) - Math.abs(a.premiumPct)),
    avgBitkub: bk.length ? bk.reduce((a, r) => a + r.premiumPct, 0) / bk.length : null,
    updatedAt: Date.now(),
  };
}
