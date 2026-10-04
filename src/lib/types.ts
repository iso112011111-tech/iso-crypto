/** แท่งเทียนรายวัน (ราคาเป็นบาท) */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number; tb?: number };

export type ExchangeId = "binance" | "okx" | "bybit" | "gate" | "mexc" | "kucoin" | "bitkub" | "binanceth";

/** ราคาของเหรียญหนึ่งบนกระดานหนึ่ง (แปลงเป็นบาทแล้ว) */
export type ExchangeQuote = { ex: ExchangeId; price: number; change24h: number; volume: number };

export type MarketCoin = {
  symbol: string;
  name: string;
  th?: string;
  image?: string;
  price: number; // THB อ้างอิงจากกระดานที่วอลุ่มสูงสุด
  change24h: number; // %
  high24h: number;
  low24h: number;
  quoteVolume: number; // THB รวมทุกกระดาน
  marketCap?: number; // THB
  rank?: number;
  exchanges: ExchangeQuote[]; // เรียงตามวอลุ่ม มาก → น้อย
  bitkubPremium?: number; // % ราคา Bitkub แพงกว่าตลาดโลก
  binanceThPremium?: number; // % ราคาคู่ THB บน Binance TH แพงกว่าตลาดโลก
  onBinanceTH?: boolean; // ซื้อได้บน Binance TH (คู่ THB หรือ USDT)
  trending?: boolean;
};

/** ข้อมูลย่อสำหรับช่องค้นหาเหรียญ */
export type CoinLite = { s: string; n: string; img?: string; r?: number; v: number; ex: number };

export type ExchangeStatus = { ex: ExchangeId; ok: boolean; pairs: number };

export type FearGreed = { value: number; label: string; history: number[] };

export type MarketsResponse = {
  usdThb: number;
  coins: MarketCoin[];
  total: number; // จำนวนเหรียญที่ตรงเงื่อนไขทั้งหมด (ก่อนแบ่งหน้า)
  universe: number; // จำนวนเหรียญทั้งหมดที่รวมได้จากทุกกระดาน
  exchanges: ExchangeStatus[];
  fearGreed: FearGreed | null;
  btcDominance: number | null;
  totalMarketCapChange24h: number | null;
  updatedAt: number;
  warnings: string[];
};

export type Factor = { key: string; label: string; points: number; max: number; note: string };

export type Analysis = {
  symbol: string;
  price: number;
  historyDays: number; // จำนวนแท่งรายวันที่ใช้วิเคราะห์
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  atr: number;
  atrPct: number;
  macdHist: number;
  macdHistPrev: number;
  volRatio: number; // ค่าเฉลี่ยวอลุ่ม 7 วัน / 30 วัน
  volatility: number; // ความผันผวนรายปี (%)
  change7d: number;
  change30d: number;
  fromHigh90d: number; // % ห่างจากจุดสูงสุด 90 วัน (ติดลบ)
  supports: number[]; // ใกล้สุดก่อน
  resistances: number[]; // ใกล้สุดก่อน
  trend: "up" | "down" | "side";
  score: number;
  factors: Factor[];
  trade: { entry: number; stopLoss: number; takeProfit: number; rrr: number };
  risk: "ต่ำ" | "ปานกลาง" | "สูง" | "สูงมาก";
  verdict: { tone: "good" | "ok" | "wait" | "bad"; headline: string; bullets: string[] };
};

/* ---------- DEX ---------- */
export type DexToken = {
  id: string; // dex:<chain>:<tokenAddress>
  chain: string;
  chainName: string;
  address: string;
  symbol: string;
  name: string;
  image?: string;
  price: number; // THB
  priceUsd: number;
  change24h: number;
  liquidity: number; // THB รวมทุกพูล
  volume24h: number; // THB
  marketCap?: number; // THB
  pairAddress: string; // พูลที่สภาพคล่องสูงสุด
  dexId: string;
  createdAt?: number;
  buys24h: number;
  sells24h: number;
  pools: number;
};

export type SafetyCheck = { label: string; status: "ok" | "warn" | "bad"; detail: string };
export type DexSafety = {
  score: number; // 0–100
  level: "ปลอดภัยพอใช้" | "ระวัง" | "อันตราย";
  checks: SafetyCheck[];
  holders?: number;
  top10Percent?: number;
  scanned: boolean; // ได้ผลจาก GoPlus หรือไม่
};
export type Slippage = { amount: number; impactPct: number }[];

/* ---------- Futures ---------- */
export type Derivatives = {
  fundingAvg: number | null; // % ต่อ 8 ชม.
  funding: { ex: string; rate: number }[];
  oiUsd: number | null;
  oiChange7d: number | null;
  oiHistory: number[];
  longShort: number | null;
  longShortHistory: number[];
  notes: { tone: "good" | "warn" | "bad" | "info"; text: string }[];
};

/* ---------- หลายกรอบเวลา ---------- */
export type TimeframeRow = { tf: "4H" | "1D" | "1W"; trend: "up" | "down" | "side"; rsi: number; note: string };
export type MultiTimeframe = { rows: TimeframeRow[]; aligned: number; summary: string };

/* ---------- แรงซื้อขาย ---------- */
export type Flow = {
  volSpike: number | null; // วอลุ่มวันล่าสุดที่ปิดแล้ว ÷ ค่าเฉลี่ย 20 วันก่อนหน้า
  takerBuy7d: number | null; // สัดส่วนแรงซื้อ market 7 วัน (0–1)
  takerBuy30d: number | null;
  dexBuys24h?: number;
  dexSells24h?: number;
  notes: string[];
};

export type CoinResponse = {
  id: string;
  candles: Candle[];
  analysis: Analysis | null; // null = ข้อมูลน้อยเกินไป (เหรียญเพิ่งเข้ากระดาน)
  notice?: string;
  market: MarketCoin | null;
  dex?: DexToken & { safety: DexSafety; slippage: Slippage };
  mtf?: MultiTimeframe | null;
  flow?: Flow;
  derivatives?: Derivatives | null;
  usdThb: number;
  source: string;
};

export type ScanRow = { symbol: string; name: string; th?: string; image?: string; source: string; analysis: Analysis };

/* ---------- ข้อมูลผู้ใช้ ---------- */
export type Holding = { symbol: string; qty: number; avgCost: number };

export type JournalEntry = {
  id: string;
  assetId: string; // "BTC" หรือ "dex:<chain>:<address>"
  symbol: string;
  entry: number; // ราคาเข้า (บาท)
  qty: number;
  sl?: number;
  tp?: number;
  openedAt: number;
  exit?: number;
  closedAt?: number;
  feePct: number;
  setupScore?: number;
  note?: string;
};

export type UserData = { portfolio: Holding[]; watchlist: string[]; journal: JournalEntry[]; updatedAt: number };
