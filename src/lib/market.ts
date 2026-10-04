import "server-only";
import { cached, getJSON } from "./http";
import { EXCHANGES, binanceThInfo, fetchCandles, fetchTickers, type Interval, type RawTicker } from "./exchanges";
import { THAI_NAMES, isJunkSymbol } from "./coins";
import type {
  Candle,
  CoinLite,
  ExchangeId,
  ExchangeQuote,
  ExchangeStatus,
  FearGreed,
  MarketCoin,
  MarketsResponse,
} from "./types";

/* ---------- อัตราแลกเปลี่ยน USDT → THB ---------- */
const FALLBACK_USD_THB = 33.5;

export function getUsdThb(): Promise<{ rate: number; live: boolean }> {
  return cached("usdthb", 5 * 60_000, async () => {
    try {
      const d = await getJSON<{ tether: { thb: number } }>(
        "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=thb",
      );
      return { rate: d.tether.thb, live: true };
    } catch {
      // สำรอง: ราคา USDT/THB บน Bitkub (อาจต่างจากเรทกลางเล็กน้อยตามแรงซื้อขายในไทย)
      try {
        const d = await getJSON<{ symbol: string; last: string }[]>("https://api.bitkub.com/api/v3/market/ticker?sym=USDT_THB");
        const rate = parseFloat(d.find((t) => t.symbol === "USDT_THB")?.last ?? "");
        if (rate > 20 && rate < 60) return { rate, live: true };
      } catch {
        /* ใช้ค่าประมาณ */
      }
      return { rate: FALLBACK_USD_THB, live: false };
    }
  });
}

/* ---------- ข้อมูลเสริมจาก CoinGecko: ชื่อเต็ม โลโก้ มาร์เก็ตแคป ---------- */
type GeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
};

/** Top 1,000 ตามมาร์เก็ตแคป (4 หน้า ทีละหน้าเพื่อไม่ชนลิมิตฟรีของ CoinGecko) ได้เท่าไหร่ใช้เท่านั้น */
async function getGeckoTop(): Promise<GeckoMarket[]> {
  return cached("gecko:top", 15 * 60_000, async () => {
    const all: GeckoMarket[] = [];
    for (let page = 1; page <= 4; page++) {
      try {
        all.push(
          ...(await getJSON<GeckoMarket[]>(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=thb&order=market_cap_desc&per_page=250&page=${page}`,
          )),
        );
      } catch {
        break;
      }
    }
    if (all.length === 0) throw new Error("CoinGecko unavailable");
    return all;
  }).catch(() => [] as GeckoMarket[]);
}

async function getTrending(): Promise<Set<string>> {
  return cached("gecko:trending", 15 * 60_000, async () => {
    try {
      const d = await getJSON<{ coins: { item: { symbol: string } }[] }>("https://api.coingecko.com/api/v3/search/trending");
      return new Set(d.coins.map((c) => c.item.symbol.toUpperCase()));
    } catch {
      return new Set<string>();
    }
  });
}

/* ---------- รวมเหรียญจากทุกกระดาน ---------- */

// กระดานใหญ่ให้น้ำหนักความน่าเชื่อถือมากกว่า (Gate/MEXC มักมีเหรียญชื่อซ้ำ/วอลุ่มปั่น)
const TRUST: Record<ExchangeId, number> = { binance: 1, okx: 1, bybit: 1, kucoin: 1, bitkub: 1, binanceth: 1, gate: 0.5, mexc: 0.4 };
const MIN_VOLUME_USD = 20_000;
const SAME_COIN_TOLERANCE = 0.15; // ราคาต่างกันเกิน 15% = น่าจะเป็นคนละเหรียญที่ใช้ชื่อซ้ำ

type Universe = {
  coins: MarketCoin[];
  bySymbol: Map<string, MarketCoin>;
  geckoIds: Map<string, string>;
  exchanges: ExchangeStatus[];
  usdThb: number;
  fxLive: boolean;
};

export function getUniverse(): Promise<Universe> {
  return cached("universe", 20_000, buildUniverse);
}

async function buildUniverse(): Promise<Universe> {
  const ids = Object.keys(EXCHANGES) as ExchangeId[];
  const [fx, gecko, trending, bth, ...tickerResults] = await Promise.all([
    getUsdThb(),
    getGeckoTop(),
    getTrending(),
    binanceThInfo().catch(() => null),
    ...ids.map((ex) =>
      cached(`tickers:${ex}`, 20_000, fetchTickers[ex]).then(
        (v) => ({ ok: true as const, v }),
        () => ({ ok: false as const, v: [] as RawTicker[] }),
      ),
    ),
  ]);

  const exchanges: ExchangeStatus[] = ids.map((ex, i) => ({ ex, ok: tickerResults[i].ok, pairs: tickerResults[i].v.length }));

  // 1) จัดกลุ่มราคาแต่ละกระดานตามชื่อเหรียญ (แปลงเป็นบาททั้งหมด)
  const groups = new Map<string, (ExchangeQuote & { high: number; low: number })[]>();
  ids.forEach((ex, i) => {
    const toThb = EXCHANGES[ex].quote === "THB" ? 1 : fx.rate;
    for (const t of tickerResults[i].v) {
      const base = t.base.toUpperCase();
      if (t.last <= 0 || t.quoteVolume <= 0 || isJunkSymbol(base)) continue;
      const list = groups.get(base) ?? [];
      list.push({
        ex,
        price: t.last * toThb,
        change24h: t.change24h,
        volume: t.quoteVolume * toThb,
        high: t.high * toThb,
        low: t.low * toThb,
      });
      groups.set(base, list);
    }
  });

  // 2) ข้อมูล CoinGecko: ถ้าชื่อซ้ำกันหลายเหรียญ เลือกตัวที่มาร์เก็ตแคปสูงสุด
  const geckoBySymbol = new Map<string, GeckoMarket>();
  for (const g of gecko) {
    const s = g.symbol.toUpperCase();
    if (!geckoBySymbol.has(s)) geckoBySymbol.set(s, g);
  }

  const coins: MarketCoin[] = [];
  const geckoIds = new Map<string, string>();
  const minVolThb = MIN_VOLUME_USD * fx.rate;

  for (const [symbol, quotes] of groups) {
    // 3) หากลุ่มราคาที่ "เห็นตรงกัน" มากที่สุด (ถ่วงด้วยวอลุ่ม × ความน่าเชื่อถือ) ตัดตัวที่ราคาหลุดกลุ่มทิ้ง
    let best = quotes;
    let bestWeight = -1;
    for (const q of quotes) {
      const cluster = quotes.filter((o) => Math.abs(o.price / q.price - 1) <= SAME_COIN_TOLERANCE);
      const w = cluster.reduce((s, o) => s + o.volume * TRUST[o.ex], 0);
      if (w > bestWeight) {
        bestWeight = w;
        best = cluster;
      }
    }
    best.sort((a, b) => b.volume * TRUST[b.ex] - a.volume * TRUST[a.ex]);
    const totalVol = best.reduce((s, q) => s + q.volume, 0);
    if (totalVol < minVolThb) continue;

    const ref = best[0];
    const g = geckoBySymbol.get(symbol);
    const meta = g && Math.abs(g.current_price / ref.price - 1) < 0.2 ? g : undefined;
    if (meta) geckoIds.set(symbol, meta.id);

    const bk = best.find((q) => q.ex === "bitkub");
    const bth_ = best.find((q) => q.ex === "binanceth");
    const global = best.find((q) => q.ex !== "bitkub" && q.ex !== "binanceth");

    coins.push({
      symbol,
      name: meta?.name ?? symbol,
      th: THAI_NAMES[symbol],
      image: meta?.image,
      price: ref.price,
      change24h: ref.change24h,
      high24h: ref.high,
      low24h: ref.low,
      quoteVolume: totalVol,
      marketCap: meta?.market_cap || undefined,
      rank: meta?.market_cap_rank || undefined,
      exchanges: [...best].sort((a, b) => b.volume - a.volume).map(({ ex, price, change24h, volume }) => ({ ex, price, change24h, volume })),
      bitkubPremium: bk && global ? (bk.price / global.price - 1) * 100 : undefined,
      binanceThPremium: bth_ && global ? (bth_.price / global.price - 1) * 100 : undefined,
      onBinanceTH: bth?.assets.has(symbol) || undefined,
      trending: trending.has(symbol) || undefined,
    });
  }

  // เหรียญจาก CoinGecko ที่ไม่มีบนกระดานไหนเลย (เช่นเทรดบน DEX อย่างเดียว) ข้ามไป เพราะซื้อผ่านกระดานไม่ได้
  coins.sort((a, b) => b.quoteVolume - a.quoteVolume);
  return {
    coins,
    bySymbol: new Map(coins.map((c) => [c.symbol, c])),
    geckoIds,
    exchanges,
    usdThb: fx.rate,
    fxLive: fx.live,
  };
}

/* ---------- ค้นหา/กรอง/เรียงเหรียญ ---------- */

export type MarketQuery = {
  sort?: "volume" | "gainers" | "losers" | "mcap";
  filter?: "all" | "bitkub" | "binanceth" | "trending" | "small";
  q?: string;
  symbols?: string[];
  limit?: number;
  offset?: number;
};

export function filterCoins(coins: MarketCoin[], query: MarketQuery, usdThb = FALLBACK_USD_THB): MarketCoin[] {
  let list = coins;
  if (query.symbols?.length) {
    const want = new Set(query.symbols.map((s) => s.toUpperCase()));
    list = list.filter((c) => want.has(c.symbol));
  }
  if (query.filter === "bitkub") list = list.filter((c) => c.exchanges.some((e) => e.ex === "bitkub"));
  if (query.filter === "binanceth") list = list.filter((c) => c.onBinanceTH);
  if (query.filter === "trending") list = list.filter((c) => c.trending);
  // เหรียญเล็ก/ใหม่: มาร์เก็ตแคปนอก Top 300 หรือยังไม่มีอันดับ (มักเป็นเหรียญเพิ่งลิสต์)
  if (query.filter === "small") list = list.filter((c) => !c.rank || c.rank > 300);
  if (query.q) {
    const q = query.q.trim().toUpperCase();
    list = list.filter((c) => c.symbol.startsWith(q) || c.name.toUpperCase().includes(q) || c.th?.includes(query.q!.trim()));
  }
  let sorted = [...list];
  if (query.sort === "gainers" || query.sort === "losers") {
    // ตัดเหรียญที่มีแค่กระดานเดียวและวอลุ่มบาง — มักเป็นราคาปั่น/สภาพคล่องหลอก (+2000% ในวันเดียว)
    const minThb = 1_000_000 * usdThb;
    sorted = sorted.filter((c) => c.exchanges.length >= 2 || c.quoteVolume >= minThb);
    sorted.sort((a, b) => (query.sort === "gainers" ? b.change24h - a.change24h : a.change24h - b.change24h));
  }
  else if (query.sort === "mcap") sorted.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  return sorted;
}

/* ---------- ภาพรวมตลาด ---------- */

async function getFearGreed(): Promise<FearGreed | null> {
  return cached("fng", 30 * 60_000, async () => {
    try {
      const d = await getJSON<{ data: { value: string; value_classification: string }[] }>(
        "https://api.alternative.me/fng/?limit=30",
      );
      return {
        value: +d.data[0].value,
        label: d.data[0].value_classification,
        history: d.data.map((x) => +x.value).reverse(),
      };
    } catch {
      return null;
    }
  });
}

async function getGlobal() {
  return cached("global", 10 * 60_000, async () => {
    try {
      const d = await getJSON<{
        data: { market_cap_percentage: { btc: number }; market_cap_change_percentage_24h_usd: number };
      }>("https://api.coingecko.com/api/v3/global");
      return {
        btcDominance: d.data.market_cap_percentage.btc,
        change24h: d.data.market_cap_change_percentage_24h_usd,
      };
    } catch {
      return null;
    }
  });
}

export async function getMarkets(query: MarketQuery): Promise<MarketsResponse> {
  const [u, fearGreed, global] = await Promise.all([getUniverse(), getFearGreed(), getGlobal()]);
  const warnings: string[] = [];
  if (!u.fxLive) warnings.push(`ดึงอัตรา USDT/THB ไม่ได้ ใช้ค่าประมาณ ${FALLBACK_USD_THB} บาท`);
  if (!fearGreed) warnings.push("ดึงดัชนี Fear & Greed ไม่ได้");
  const down = u.exchanges.filter((e) => !e.ok).map((e) => EXCHANGES[e.ex].name);
  if (down.length) warnings.push(`เชื่อมต่อ ${down.join(", ")} ไม่ได้ชั่วคราว — แสดงข้อมูลจากกระดานที่เหลือ`);

  const list = filterCoins(u.coins, query, u.usdThb);
  const offset = query.offset ?? 0;
  const limit = Math.min(query.limit ?? 50, 200);

  return {
    usdThb: u.usdThb,
    coins: list.slice(offset, offset + limit),
    total: list.length,
    universe: u.coins.length,
    exchanges: u.exchanges,
    fearGreed,
    btcDominance: global?.btcDominance ?? null,
    totalMarketCapChange24h: global?.change24h ?? null,
    updatedAt: Date.now(),
    warnings,
  };
}

/** รายชื่อเหรียญทั้งหมดแบบย่อ สำหรับช่องค้นหา */
export async function getCoinList(): Promise<CoinLite[]> {
  const u = await getUniverse();
  return u.coins.map((c) => ({ s: c.symbol, n: c.name, img: c.image, r: c.rank, v: Math.round(c.quoteVolume), ex: c.exchanges.length }));
}

/* ---------- แท่งเทียนรายวัน (THB) ---------- */

export class UnknownCoinError extends Error {}

/**
 * ดึงแท่งเทียนจากกระดานที่วอลุ่มสูงสุดก่อน ถ้าได้ข้อมูลสั้น (เหรียญเพิ่งเข้ากระดานนั้น)
 * จะลองกระดานถัดไปแล้วเลือกชุดที่ยาวที่สุด สุดท้ายถ้าทุกกระดานล้มเหลวจะใช้ราคาปิดจาก CoinGecko
 */
export async function getCandles(
  symbol: string,
  limit = 500,
  iv: Interval = "1d",
): Promise<{ candles: Candle[]; source: string; market: MarketCoin }> {
  const u = await getUniverse();
  const market = u.bySymbol.get(symbol.toUpperCase());
  if (!market) throw new UnknownCoinError(symbol);

  return cached(`candles:${market.symbol}:${limit}:${iv}`, iv === "4h" ? 5 * 60_000 : 10 * 60_000, async () => {
    const enough = Math.min(limit, 300);
    let best: { candles: Candle[]; source: string } | null = null;

    for (const { ex } of market.exchanges.slice(0, 4)) {
      try {
        const raw = await fetchCandles[ex](market.symbol, limit, iv);
        const toThb = EXCHANGES[ex].quote === "THB" ? 1 : u.usdThb;
        const candles = raw.map((c) => ({ t: c.t, o: c.o * toThb, h: c.h * toThb, l: c.l * toThb, c: c.c * toThb, v: c.v, tb: c.tb }));
        if (!best || candles.length > best.candles.length) best = { candles, source: EXCHANGES[ex].name };
        if (candles.length >= enough) break;
      } catch {
        /* ลองกระดานถัดไป */
      }
    }

    if (iv === "1d" && (!best || best.candles.length < 35)) {
      const id = u.geckoIds.get(market.symbol);
      if (id) {
        try {
          const d = await getJSON<{ prices: [number, number][]; total_volumes: [number, number][] }>(
            `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=thb&days=365&interval=daily`,
          );
          // CoinGecko ให้แค่ราคาปิด: ประมาณ open = ปิดวันก่อน, high/low = ค่ามาก/น้อยของสองค่านั้น
          const candles = d.prices.map(([t, c], i) => {
            const o = i ? d.prices[i - 1][1] : c;
            return { t, o, h: Math.max(o, c), l: Math.min(o, c), c, v: (d.total_volumes[i]?.[1] ?? 0) / c };
          });
          if (!best || candles.length > best.candles.length) best = { candles, source: "CoinGecko (ราคาปิดรายวัน)" };
        } catch {
          /* ไม่มีแหล่งสำรองแล้ว */
        }
      }
    }

    if (!best || best.candles.length === 0) throw new Error(`ไม่พบข้อมูลกราฟของ ${market.symbol}`);
    return best;
  }).then((r) => ({ ...r, market }));
}
