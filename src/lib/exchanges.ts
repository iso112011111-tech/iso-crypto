import "server-only";

/**
 * อะแดปเตอร์ของแต่ละกระดาน: แปลงข้อมูลหน้าตาต่างกันให้อยู่รูปแบบเดียว
 * ราคาทั้งหมดเป็น USDT ยกเว้น Bitkub ที่เป็น THB (แปลงทีหลังใน market.ts)
 */

export type ExchangeId = "binance" | "okx" | "bybit" | "gate" | "mexc" | "kucoin" | "bitkub" | "binanceth";

export const EXCHANGES: Record<ExchangeId, { name: string; short: string; quote: "USDT" | "THB" }> = {
  binance: { name: "Binance", short: "BN", quote: "USDT" },
  okx: { name: "OKX", short: "OKX", quote: "USDT" },
  bybit: { name: "Bybit", short: "BY", quote: "USDT" },
  gate: { name: "Gate", short: "GT", quote: "USDT" },
  mexc: { name: "MEXC", short: "MX", quote: "USDT" },
  kucoin: { name: "KuCoin", short: "KC", quote: "USDT" },
  bitkub: { name: "Bitkub", short: "BK", quote: "THB" },
  // Binance TH: ใช้เฉพาะคู่ THB (คู่ USDT ใช้สมุดคำสั่งร่วมกับ Binance global จึงไม่นับซ้ำ)
  binanceth: { name: "Binance TH", short: "BTH", quote: "THB" },
};

/** ticker 24 ชม. แบบรวมรูปแบบ (ราคาเป็นสกุล quote ของกระดานนั้น) */
export type RawTicker = {
  base: string;
  last: number;
  change24h: number; // %
  high: number;
  low: number;
  quoteVolume: number;
};

/** แท่งเทียน เรียงเก่า → ใหม่ (ราคาเป็นสกุล quote ของกระดานนั้น) · tb = วอลุ่มฝั่งซื้อแบบ market (มีเฉพาะบางกระดาน) */
export type RawCandle = { t: number; o: number; h: number; l: number; c: number; v: number; tb?: number };

export type Interval = "4h" | "1d";

const INTERVALS: Record<ExchangeId, Record<Interval, string>> = {
  binance: { "4h": "4h", "1d": "1d" },
  okx: { "4h": "4H", "1d": "1Dutc" },
  bybit: { "4h": "240", "1d": "D" },
  gate: { "4h": "4h", "1d": "1d" },
  mexc: { "4h": "4h", "1d": "1d" },
  kucoin: { "4h": "4hour", "1d": "1day" },
  bitkub: { "4h": "240", "1d": "1D" },
  binanceth: { "4h": "4h", "1d": "1d" },
};
const SECONDS: Record<Interval, number> = { "4h": 14_400, "1d": 86_400 };

async function getJSON<T>(url: string, timeoutMs = 9000): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// api.binance.com บางพื้นที่ถูกบล็อก จึงมีสำรองเป็น data-api.binance.vision (ข้อมูลตลาดชุดเดียวกัน)
async function binance<T>(path: string): Promise<T> {
  try {
    return await getJSON<T>("https://api.binance.com" + path);
  } catch {
    return getJSON<T>("https://data-api.binance.vision" + path);
  }
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const pctFromOpen = (last: number, open: number) => (open > 0 ? (last / open - 1) * 100 : 0);

/* ---------------------------------- Binance TH ---------------------------------- */

const BTH = "https://api.binance.th/api/v1";
let bthInfo: { at: number; thb: string[]; assets: Set<string> } | null = null;

/** รายชื่อคู่เทรดที่เปิดอยู่บน Binance TH (แคช 1 ชม.) */
export async function binanceThInfo() {
  if (bthInfo && Date.now() - bthInfo.at < 3600_000) return bthInfo;
  const d = await getJSON<{ symbols: { symbol: string; status: string; baseAsset: string; quoteAsset: string }[] }>(`${BTH}/exchangeInfo`, 12000);
  const trading = d.symbols.filter((x) => x.status === "TRADING");
  bthInfo = {
    at: Date.now(),
    thb: trading.filter((x) => x.quoteAsset === "THB").map((x) => x.symbol),
    assets: new Set(trading.filter((x) => x.quoteAsset === "THB" || x.quoteAsset === "USDT").map((x) => x.baseAsset.toUpperCase())),
  };
  return bthInfo;
}

/* ---------------------------------- tickers ---------------------------------- */

export const fetchTickers: Record<ExchangeId, () => Promise<RawTicker[]>> = {
  async binance() {
    type T = { symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string };
    const d = await binance<T[]>("/api/v3/ticker/24hr");
    return d
      .filter((t) => t.symbol.endsWith("USDT"))
      .map((t) => ({
        base: t.symbol.slice(0, -4),
        last: num(t.lastPrice),
        change24h: num(t.priceChangePercent),
        high: num(t.highPrice),
        low: num(t.lowPrice),
        quoteVolume: num(t.quoteVolume),
      }));
  },
  async okx() {
    type T = { instId: string; last: string; open24h: string; high24h: string; low24h: string; volCcy24h: string };
    const d = await getJSON<{ data: T[] }>("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
    return d.data
      .filter((t) => t.instId.endsWith("-USDT"))
      .map((t) => ({
        base: t.instId.slice(0, -5),
        last: num(t.last),
        change24h: pctFromOpen(num(t.last), num(t.open24h)),
        high: num(t.high24h),
        low: num(t.low24h),
        quoteVolume: num(t.volCcy24h),
      }));
  },
  async bybit() {
    type T = { symbol: string; lastPrice: string; price24hPcnt: string; highPrice24h: string; lowPrice24h: string; turnover24h: string };
    const d = await getJSON<{ result: { list: T[] } }>("https://api.bybit.com/v5/market/tickers?category=spot");
    return d.result.list
      .filter((t) => t.symbol.endsWith("USDT"))
      .map((t) => ({
        base: t.symbol.slice(0, -4),
        last: num(t.lastPrice),
        change24h: num(t.price24hPcnt) * 100,
        high: num(t.highPrice24h),
        low: num(t.lowPrice24h),
        quoteVolume: num(t.turnover24h),
      }));
  },
  async gate() {
    type T = { currency_pair: string; last: string; change_percentage: string; high_24h: string; low_24h: string; quote_volume: string };
    const d = await getJSON<T[]>("https://api.gateio.ws/api/v4/spot/tickers", 12000);
    return d
      .filter((t) => t.currency_pair.endsWith("_USDT"))
      .map((t) => ({
        base: t.currency_pair.slice(0, -5),
        last: num(t.last),
        change24h: num(t.change_percentage),
        high: num(t.high_24h),
        low: num(t.low_24h),
        quoteVolume: num(t.quote_volume),
      }));
  },
  async mexc() {
    type T = { symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string };
    const d = await getJSON<T[]>("https://api.mexc.com/api/v3/ticker/24hr");
    return d
      .filter((t) => t.symbol.endsWith("USDT"))
      .map((t) => ({
        base: t.symbol.slice(0, -4),
        last: num(t.lastPrice),
        change24h: num(t.priceChangePercent) * 100, // MEXC ส่งมาเป็นสัดส่วน
        high: num(t.highPrice),
        low: num(t.lowPrice),
        quoteVolume: num(t.quoteVolume),
      }));
  },
  async kucoin() {
    type T = { symbol: string; last: string; changeRate: string; high: string; low: string; volValue: string };
    const d = await getJSON<{ data: { ticker: T[] } }>("https://api.kucoin.com/api/v1/market/allTickers");
    return d.data.ticker
      .filter((t) => t.symbol.endsWith("-USDT"))
      .map((t) => ({
        base: t.symbol.slice(0, -5),
        last: num(t.last),
        change24h: num(t.changeRate) * 100,
        high: num(t.high),
        low: num(t.low),
        quoteVolume: num(t.volValue),
      }));
  },
  async binanceth() {
    type T = { symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string };
    const { thb } = await binanceThInfo();
    const list = await Promise.all(thb.map((sym) => getJSON<T>(`${BTH}/ticker/24hr?symbol=${sym}`).catch(() => null)));
    return list
      .filter((t): t is T => !!t)
      .map((t) => ({
        base: t.symbol.slice(0, -3),
        last: num(t.lastPrice),
        change24h: num(t.priceChangePercent),
        high: num(t.highPrice),
        low: num(t.lowPrice),
        quoteVolume: num(t.quoteVolume),
      }));
  },
  async bitkub() {
    type T = { symbol: string; last: string; percent_change: string; high_24_hr: string; low_24_hr: string; quote_volume: string };
    const d = await getJSON<T[]>("https://api.bitkub.com/api/v3/market/ticker");
    return d
      .filter((t) => t.symbol.endsWith("_THB"))
      .map((t) => ({
        base: t.symbol.slice(0, -4),
        last: num(t.last),
        change24h: num(t.percent_change),
        high: num(t.high_24_hr),
        low: num(t.low_24_hr),
        quoteVolume: num(t.quote_volume),
      }));
  },
};

/* ---------------------------------- candles ---------------------------------- */

const asc = (cs: RawCandle[]) => cs.filter((c) => c.c > 0).sort((a, b) => a.t - b.t);

export const fetchCandles: Record<ExchangeId, (base: string, limit: number, iv?: Interval) => Promise<RawCandle[]>> = {
  async binance(base, limit, iv = "1d") {
    const d = await binance<(string | number)[][]>(`/api/v3/klines?symbol=${base}USDT&interval=${INTERVALS.binance[iv]}&limit=${Math.min(limit, 1000)}`);
    return asc(d.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]), tb: num(k[9]) })));
  },
  async okx(base, limit, iv = "1d") {
    const d = await getJSON<{ data: string[][] }>(`https://www.okx.com/api/v5/market/candles?instId=${base}-USDT&bar=${INTERVALS.okx[iv]}&limit=${Math.min(limit, 300)}`);
    return asc(d.data.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]) })));
  },
  async bybit(base, limit, iv = "1d") {
    const d = await getJSON<{ result: { list: string[][] } }>(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${base}USDT&interval=${INTERVALS.bybit[iv]}&limit=${Math.min(limit, 1000)}`);
    return asc(d.result.list.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]) })));
  },
  async gate(base, limit, iv = "1d") {
    // Gate: [เวลา(วินาที), วอลุ่ม quote, close, high, low, open, วอลุ่ม base, ปิดแท่งแล้ว]
    const d = await getJSON<string[][]>(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${base}_USDT&interval=${INTERVALS.gate[iv]}&limit=${Math.min(limit, 1000)}`, 12000);
    return asc(d.map((k) => ({ t: num(k[0]) * 1000, o: num(k[5]), h: num(k[3]), l: num(k[4]), c: num(k[2]), v: num(k[6]) })));
  },
  async mexc(base, limit, iv = "1d") {
    const d = await getJSON<(string | number)[][]>(`https://api.mexc.com/api/v3/klines?symbol=${base}USDT&interval=${INTERVALS.mexc[iv]}&limit=${Math.min(limit, 1000)}`);
    return asc(d.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]) })));
  },
  async kucoin(base, limit, iv = "1d") {
    // KuCoin: [เวลา(วินาที), open, close, high, low, วอลุ่ม, turnover]
    const end = Math.floor(Date.now() / 1000);
    const start = end - Math.min(limit, 1500) * SECONDS[iv];
    const d = await getJSON<{ data: string[][] }>(`https://api.kucoin.com/api/v1/market/candles?type=${INTERVALS.kucoin[iv]}&symbol=${base}-USDT&startAt=${start}&endAt=${end}`);
    return asc(d.data.map((k) => ({ t: num(k[0]) * 1000, o: num(k[1]), h: num(k[3]), l: num(k[4]), c: num(k[2]), v: num(k[5]) })));
  },
  async binanceth(base, limit, iv = "1d") {
    const d = await getJSON<(string | number)[][]>(`${BTH}/klines?symbol=${base}THB&interval=${INTERVALS.binanceth[iv]}&limit=${Math.min(limit, 1000)}`);
    return asc(d.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), v: num(k[5]), tb: num(k[9]) })));
  },
  async bitkub(base, limit, iv = "1d") {
    const to = Math.floor(Date.now() / 1000);
    const from = to - limit * SECONDS[iv];
    const d = await getJSON<{ s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }>(
      `https://api.bitkub.com/tradingview/history?symbol=${base}_THB&resolution=${INTERVALS.bitkub[iv]}&from=${from}&to=${to}`,
    );
    if (d.s !== "ok" || !d.t) return [];
    return asc(d.t.map((t, i) => ({ t: t * 1000, o: d.o[i], h: d.h[i], l: d.l[i], c: d.c[i], v: d.v[i] })));
  },
};
