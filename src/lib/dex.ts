import "server-only";
import { cached, getJSON } from "./http";
import type { Candle, DexSafety, DexToken, SafetyCheck, Slippage } from "./types";

/**
 * เหรียญบน DEX (กระดานแลกเปลี่ยนแบบกระจายศูนย์)
 * - DexScreener: ค้นหา/ราคา/สภาพคล่อง
 * - GeckoTerminal: แท่งเทียน
 * - GoPlus: ตรวจสัญญาเหรียญหลอก (honeypot, ภาษีซื้อขาย, สิทธิ์เจ้าของ)
 */

type ChainInfo = { name: string; gt: string; goplus?: string };

// chainId ของ DexScreener → network id ของ GeckoTerminal และ chain id ของ GoPlus
export const CHAINS: Record<string, ChainInfo> = {
  ethereum: { name: "Ethereum", gt: "eth", goplus: "1" },
  bsc: { name: "BNB Chain", gt: "bsc", goplus: "56" },
  solana: { name: "Solana", gt: "solana", goplus: "solana" },
  base: { name: "Base", gt: "base", goplus: "8453" },
  arbitrum: { name: "Arbitrum", gt: "arbitrum", goplus: "42161" },
  polygon: { name: "Polygon", gt: "polygon_pos", goplus: "137" },
  optimism: { name: "Optimism", gt: "optimism", goplus: "10" },
  avalanche: { name: "Avalanche", gt: "avax", goplus: "43114" },
  worldchain: { name: "World Chain", gt: "world-chain", goplus: "480" },
  linea: { name: "Linea", gt: "linea", goplus: "59144" },
  zksync: { name: "zkSync", gt: "zksync", goplus: "324" },
  mantle: { name: "Mantle", gt: "mantle", goplus: "5000" },
  unichain: { name: "Unichain", gt: "unichain", goplus: "130" },
  tron: { name: "Tron", gt: "tron", goplus: "tron" },
  sui: { name: "Sui", gt: "sui-network" },
  ton: { name: "TON", gt: "ton" },
  blast: { name: "Blast", gt: "blast" },
  sonic: { name: "Sonic", gt: "sonic" },
  berachain: { name: "Berachain", gt: "berachain" },
  hyperevm: { name: "HyperEVM", gt: "hyperevm" },
  abstract: { name: "Abstract", gt: "abstract" },
  monad: { name: "Monad", gt: "monad", goplus: "143" },
};

const chainName = (c: string) => CHAINS[c]?.name ?? c;

type DsPair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  txns?: { h24?: { buys: number; sells: number } };
  info?: { imageUrl?: string };
};

// เหรียญที่ไม่ควรถือเป็น "เหรียญที่ค้นหา" เวลาอยู่ฝั่ง base ของพูล
const QUOTE_LIKE = new Set(["USDC", "USDT", "WETH", "WBNB", "SOL", "WSOL", "ETH", "DAI", "USDC.E", "WLD", "WMATIC", "WAVAX"]);

/** รวมหลายพูลของเหรียญเดียวกันเป็นหนึ่งรายการ ใช้พูลที่สภาพคล่องสูงสุดเป็นราคาอ้างอิง */
function aggregate(pairs: DsPair[], usdThb: number): DexToken[] {
  const groups = new Map<string, DsPair[]>();
  for (const p of pairs) {
    if (!p.priceUsd) continue;
    const key = `${p.chainId}:${p.baseToken.address.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const out: DexToken[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const top = list[0];
    const priceUsd = parseFloat(top.priceUsd!);
    const liq = list.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    const vol = list.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    const created = Math.min(...list.map((p) => p.pairCreatedAt ?? Infinity));
    const mc = top.marketCap ?? top.fdv;
    out.push({
      id: `dex:${top.chainId}:${top.baseToken.address}`,
      chain: top.chainId,
      chainName: chainName(top.chainId),
      address: top.baseToken.address,
      symbol: top.baseToken.symbol,
      name: top.baseToken.name,
      image: list.find((p) => p.info?.imageUrl)?.info?.imageUrl,
      price: priceUsd * usdThb,
      priceUsd,
      change24h: top.priceChange?.h24 ?? 0,
      liquidity: liq * usdThb,
      volume24h: vol * usdThb,
      marketCap: mc ? mc * usdThb : undefined,
      pairAddress: top.pairAddress,
      dexId: top.dexId,
      createdAt: Number.isFinite(created) ? created : undefined,
      buys24h: list.reduce((s, p) => s + (p.txns?.h24?.buys ?? 0), 0),
      sells24h: list.reduce((s, p) => s + (p.txns?.h24?.sells ?? 0), 0),
      pools: list.length,
    });
  }
  return out;
}

/** ค้นหาเหรียญ DEX ด้วยชื่อ สัญลักษณ์ หรือที่อยู่คอนแทรกต์ (เรียงตามสภาพคล่อง) */
export async function searchDex(q: string, usdThb: number): Promise<DexToken[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const pairs = await cached(`ds:search:${query.toLowerCase()}`, 60_000, async () => {
    const d = await getJSON<{ pairs: DsPair[] | null }>(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    return d.pairs ?? [];
  });
  return aggregate(pairs, usdThb)
    .filter((t) => !QUOTE_LIKE.has(t.symbol.toUpperCase()) || t.symbol.toUpperCase() === query.toUpperCase())
    .filter((t) => t.liquidity > 0)
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 15);
}

export class UnknownDexTokenError extends Error {}

export async function getDexToken(chain: string, address: string, usdThb: number): Promise<DexToken> {
  // tokens/v1 คืนแค่บางพูล → รวมกับผลค้นหาด้วยที่อยู่คอนแทรกต์ เพื่อให้ได้ครบทุกพูล
  const pairs = await cached(`ds:token:${chain}:${address.toLowerCase()}`, 30_000, async () => {
    const [byToken, bySearch] = await Promise.all([
      getJSON<DsPair[]>(`https://api.dexscreener.com/tokens/v1/${chain}/${address}`).catch(() => [] as DsPair[]),
      getJSON<{ pairs: DsPair[] | null }>(`https://api.dexscreener.com/latest/dex/search?q=${address}`)
        .then((d) => d.pairs ?? [])
        .catch(() => [] as DsPair[]),
    ]);
    const all = new Map<string, DsPair>();
    for (const p of [...byToken, ...bySearch]) if (p.chainId === chain) all.set(p.pairAddress.toLowerCase(), p);
    return [...all.values()];
  });
  const mine = pairs.filter((p) => p.baseToken.address.toLowerCase() === address.toLowerCase());
  const t = aggregate(mine.length ? mine : pairs, usdThb)[0];
  if (!t) throw new UnknownDexTokenError(`${chain}:${address}`);
  return t;
}

/** แท่งเทียนของเหรียญในพูล DEX (ราคาเป็นบาท) */
export async function getDexCandles(
  t: Pick<DexToken, "chain" | "pairAddress" | "address">,
  usdThb: number,
  iv: "4h" | "1d" = "1d",
): Promise<Candle[]> {
  const net = CHAINS[t.chain]?.gt;
  if (!net) return [];
  const path = iv === "4h" ? "hour?aggregate=4" : "day?aggregate=1";
  const list = await cached(`gt:${net}:${t.pairAddress}:${iv}`, iv === "4h" ? 5 * 60_000 : 15 * 60_000, async () => {
    const d = await getJSON<{ data: { attributes: { ohlcv_list: number[][] } } }>(
      `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${t.pairAddress}/ohlcv/${path}&limit=500&currency=usd&token=${t.address}`,
    );
    return d.data.attributes.ohlcv_list;
  }).catch(() => [] as number[][]);
  return list
    .map(([ts, o, h, l, c, v]) => ({ t: ts * 1000, o: o * usdThb, h: h * usdThb, l: l * usdThb, c: c * usdThb, v: c > 0 ? v / c : 0 }))
    .filter((c) => c.c > 0)
    .sort((a, b) => a.t - b.t);
}

/* ---------- ตรวจความปลอดภัย ---------- */

type GoPlusHolder = { percent: string; is_contract?: number; is_locked?: number; tag?: string };
type GoPlusEvm = Record<string, string | GoPlusHolder[] | undefined> & { holders?: GoPlusHolder[]; lp_holders?: GoPlusHolder[] };

const flag = (v: unknown) => v === "1" || v === 1 || (typeof v === "object" && v !== null && (v as { status?: string }).status === "1");

export async function getDexSafety(t: DexToken, usdThb: number): Promise<DexSafety> {
  const checks: SafetyCheck[] = [];
  let score = 100;
  let critical = false;
  let holders: number | undefined;
  let top10: number | undefined;
  let scanned = false;

  const gp = CHAINS[t.chain]?.goplus;
  if (gp) {
    const url =
      gp === "solana"
        ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${t.address}`
        : `https://api.gopluslabs.io/api/v1/token_security/${gp}?contract_addresses=${t.address}`;
    const r = await cached(`gp:${gp}:${t.address.toLowerCase()}`, 30 * 60_000, async () => {
      const d = await getJSON<{ code: number; result: Record<string, GoPlusEvm> | null }>(url, 12000);
      return d.result ? (Object.values(d.result)[0] ?? null) : null;
    }).catch(() => null);

    if (r) {
      scanned = true;
      const pct = (v: unknown) => (typeof v === "string" && v !== "" ? parseFloat(v) * 100 : null);

      if (flag(r.is_honeypot) || flag(r.cannot_sell_all)) {
        critical = true;
        checks.push({ label: "ขายได้จริงไหม", status: "bad", detail: "ตรวจพบว่าเป็น Honeypot — ซื้อได้แต่ขายไม่ได้" });
      } else if (gp !== "solana") {
        checks.push({ label: "ขายได้จริงไหม", status: "ok", detail: "ไม่พบลักษณะ Honeypot" });
      }

      const buyTax = pct(r.buy_tax);
      const sellTax = pct(r.sell_tax);
      const tax = Math.max(buyTax ?? 0, sellTax ?? 0);
      if (buyTax != null || sellTax != null) {
        if (tax > 10) score -= 30;
        else if (tax > 3) score -= 10;
        checks.push({
          label: "ภาษีซื้อ/ขาย",
          status: tax > 10 ? "bad" : tax > 3 ? "warn" : "ok",
          detail: `ซื้อ ${(buyTax ?? 0).toFixed(1)}% · ขาย ${(sellTax ?? 0).toFixed(1)}%`,
        });
      }

      if (flag(r.is_mintable) || flag(r.mintable)) {
        score -= 15;
        checks.push({ label: "เสกเหรียญเพิ่มได้", status: "warn", detail: "เจ้าของยังพิมพ์เหรียญเพิ่มได้ — เสี่ยงโดนเทขาย" });
      } else checks.push({ label: "เสกเหรียญเพิ่มได้", status: "ok", detail: "ไม่สามารถพิมพ์เหรียญเพิ่ม" });

      const ownerPowers = [
        ["hidden_owner", "มีเจ้าของซ่อนอยู่"],
        ["can_take_back_ownership", "ดึงสิทธิ์เจ้าของกลับได้"],
        ["selfdestruct", "ทำลายสัญญาได้"],
        ["transfer_pausable", "หยุดการโอนได้"],
        ["is_blacklisted", "แบนกระเป๋าได้"],
        ["slippage_modifiable", "แก้ภาษีได้"],
        ["freezable", "แช่แข็งกระเป๋าได้"],
        ["balance_mutable_authority", "แก้ยอดเงินในกระเป๋าได้"],
      ] as const;
      const powers = ownerPowers.filter(([k]) => flag(r[k])).map(([, label]) => label);
      score -= Math.min(30, powers.length * 10);
      checks.push({
        label: "อำนาจเจ้าของสัญญา",
        status: powers.length ? (powers.length > 1 ? "bad" : "warn") : "ok",
        detail: powers.length ? powers.join(", ") : "ไม่พบสิทธิ์อันตราย",
      });

      if (gp !== "solana") {
        if (r.is_open_source === "0") {
          score -= 15;
          checks.push({ label: "เปิดเผยโค้ด", status: "bad", detail: "ไม่เปิดเผยโค้ดสัญญา — ตรวจสอบไม่ได้" });
        } else if (r.is_open_source === "1") checks.push({ label: "เปิดเผยโค้ด", status: "ok", detail: "โค้ดสัญญาตรวจสอบได้" });
        if (r.is_proxy === "1") score -= 5;
      }

      const hs = (r.holders ?? []) as GoPlusHolder[];
      if (hs.length) {
        // นับเฉพาะกระเป๋าคน (ไม่ใช่สัญญา/พูล/ล็อก) เพื่อดูการกระจุกตัว
        top10 = hs
          .filter((h) => !h.is_contract && !h.is_locked)
          .slice(0, 10)
          .reduce((s, h) => s + parseFloat(h.percent) * 100, 0);
        if (top10 > 50) score -= 20;
        else if (top10 > 30) score -= 10;
        checks.push({
          label: "การกระจุกตัว",
          status: top10 > 50 ? "bad" : top10 > 30 ? "warn" : "ok",
          detail: `10 กระเป๋าใหญ่ถือ ${top10.toFixed(1)}%`,
        });
      }
      const hc = typeof r.holder_count === "string" ? parseInt(r.holder_count) : NaN;
      if (Number.isFinite(hc)) holders = hc;
    }
  }

  const liqUsd = t.liquidity / usdThb;
  // สภาพคล่องต่ำ = ขายออกยาก ราคาไหลแรง ถือเป็นความเสี่ยงหลักของเหรียญ DEX
  if (liqUsd < 10_000) score -= 40;
  else if (liqUsd < 50_000) score -= 25;
  else if (liqUsd < 250_000) score -= 10;
  checks.push({
    label: "สภาพคล่อง",
    status: liqUsd < 10_000 ? "bad" : liqUsd < 50_000 ? "warn" : "ok",
    detail: `เงินในพูลรวม ~$${Math.round(liqUsd).toLocaleString("en-US")}`,
  });

  if (t.createdAt) {
    const days = (Date.now() - t.createdAt) / 86_400_000;
    if (days < 3) score -= 20;
    else if (days < 30) score -= 10;
    checks.push({
      label: "อายุพูล",
      status: days < 3 ? "bad" : days < 30 ? "warn" : "ok",
      detail: days < 1 ? "เปิดไม่ถึง 1 วัน" : `${Math.floor(days)} วัน`,
    });
  }

  if (!scanned) {
    score -= 10;
    checks.push({ label: "ตรวจสัญญา", status: "warn", detail: "เชนนี้ยังตรวจสัญญาอัตโนมัติไม่ได้ — ระวังเป็นพิเศษ" });
  }

  score = critical ? 0 : Math.max(0, Math.min(100, score));
  // มีข้อที่ "อันตราย" แม้ข้อเดียว (เช่น สภาพคล่องต่ำมาก) ไม่ควรได้ป้ายปลอดภัย
  if (checks.some((c) => c.status === "bad")) score = Math.min(score, 60);
  return {
    score,
    level: score >= 70 ? "ปลอดภัยพอใช้" : score >= 40 ? "ระวัง" : "อันตราย",
    checks,
    holders,
    top10Percent: top10,
    scanned,
  };
}

/**
 * ประมาณราคาไหลตอนขาย (โมเดลพูล x·y=k: ฝั่งเงินในพูล ≈ ครึ่งหนึ่งของสภาพคล่อง)
 * พูลแบบ concentrated (Uniswap v3/v4) อาจไหลน้อยหรือมากกว่านี้ ใช้เป็นตัวเลขคร่าว ๆ
 */
export function estimateSlippage(liquidityThb: number, amounts = [1_000, 10_000, 100_000]): Slippage {
  const reserve = liquidityThb / 2;
  return amounts.map((amount) => ({ amount, impactPct: reserve > 0 ? (amount / (reserve + amount)) * 100 : 100 }));
}
