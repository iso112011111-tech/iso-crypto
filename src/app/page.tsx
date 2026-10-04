"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { useCoin, useMarkets } from "@/hooks/data";
import { useUser } from "@/hooks/user";
import { Gauge } from "@/components/Charts";
import { ExchangeBadges } from "@/components/CoinPicker";
import Portfolio from "@/components/Portfolio";
import LivePrice from "@/components/LivePrice";
import { Card, CoinIcon, Disclaimer, ErrorBox, PageTitle, Pct, Segmented, Skeleton, Stat } from "@/components/ui";
import { fmtCompactTHB } from "@/lib/format";
import type { Analysis } from "@/lib/types";

const FNG_TH: Record<string, string> = {
  "Extreme Fear": "กลัวสุดขีด",
  Fear: "กลัว",
  Neutral: "เป็นกลาง",
  Greed: "โลภ",
  "Extreme Greed": "โลภสุดขีด",
};

/** ภาวะตลาดโดยรวม จากโครงสร้างราคา BTC + อารมณ์ตลาด */
function regime(btc: Analysis | null | undefined, fng: number | undefined) {
  if (!btc) return null;
  if (btc.trend === "up" && (fng ?? 50) > 75) return { label: "ร้อนแรง", note: "ขาขึ้นแต่ตลาดโลภจัด อย่าไล่ราคา", cls: "text-warn" };
  if (btc.trend === "up") return { label: "Risk-On", note: "BTC ขาขึ้น เน้นสะสมช่วงย่อ", cls: "text-up" };
  if (btc.trend === "down" && (fng ?? 50) < 25) return { label: "กลัวจัด", note: "ของถูกเริ่มมา ทยอยไม้เล็ก", cls: "text-fg" };
  if (btc.trend === "down") return { label: "Risk-Off", note: "BTC ขาลง ถือเงินสดเยอะ", cls: "text-down" };
  return { label: "ไซด์เวย์", note: "ตลาดยังไม่เลือกทาง", cls: "text-warn" };
}

const TABS = [
  { value: "volume", label: "วอลุ่มสูงสุด", sort: "volume", filter: "all" },
  { value: "watch", label: "★ โปรด", sort: "volume", filter: "all" },
  { value: "gainers", label: "ขึ้นแรง", sort: "gainers", filter: "all" },
  { value: "losers", label: "ลงแรง", sort: "losers", filter: "all" },
  { value: "trending", label: "มาแรง", sort: "volume", filter: "trending" },
  { value: "small", label: "เหรียญเล็ก/ใหม่", sort: "volume", filter: "small" },
  { value: "bitkub", label: "Bitkub", sort: "volume", filter: "bitkub" },
  { value: "binanceth", label: "Binance TH", sort: "volume", filter: "binanceth" },
  { value: "mcap", label: "มาร์เก็ตแคป", sort: "mcap", filter: "all" },
] as const;

export default function Dashboard() {
  const router = useRouter();
  const user = useUser();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("volume");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const q = useDeferredValue(search);
  const t = TABS.find((x) => x.value === tab)!;
  const watchCex = user.data.watchlist.filter((id) => !id.startsWith("dex:"));
  const watchDex = user.data.watchlist.filter((id) => id.startsWith("dex:"));

  const markets = useMarkets(
    tab === "watch"
      ? { symbols: watchCex, limit: 200 }
      : { sort: t.sort, filter: t.filter, q: q || undefined, limit },
  );
  const btc = useCoin("BTC");
  const emptyWatch = tab === "watch" && watchCex.length === 0;
  const m = markets.data;
  const fng = m?.fearGreed;
  const reg = regime(btc.data?.analysis, fng?.value);

  return (
    <main>
      <PageTitle
        title={<>ภาพรวม<span className="text-gradient">ตลาด</span></>}
        sub={m ? `${m.universe.toLocaleString("th-TH")} เหรียญจาก ${m.exchanges.filter((e) => e.ok).length} กระดาน · ราคาเป็นเงินบาท · ค้นหาเหรียญ DEX ได้จากช่องด้านบน` : "กำลังรวมข้อมูลจากทุกกระดาน…"}
        right={
          <span className="flex items-center gap-2 text-xs text-muted">
            <span className={`size-1.5 rounded-full ${markets.isLive ? "live-dot bg-up" : "bg-dim"}`} />
            {markets.isLive ? "ราคาสด" : "กำลังเชื่อมต่อ"}
          </span>
        }
      />

      {markets.error && <ErrorBox msg={`โหลดข้อมูลตลาดไม่สำเร็จ: ${markets.error}`} onRetry={markets.reload} />}
      {m?.warnings.map((w) => (
        <p key={w} className="mb-3 text-xs text-warn">
          {w}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="ภาวะตลาด" value={reg ? <span className={reg.cls}>{reg.label}</span> : <Skeleton className="h-7 w-24" />} sub={reg?.note} />
        <Stat
          label="Fear & Greed"
          value={
            fng ? (
              <span className="flex items-center gap-3">
                <span className="w-14">
                  <Gauge value={fng.value} />
                </span>
                <span>
                  <span className="num">{fng.value}</span> <span className="text-sm font-normal text-muted">{FNG_TH[fng.label] ?? fng.label}</span>
                </span>
              </span>
            ) : (
              <Skeleton className="h-7 w-28" />
            )
          }
        />
        <Stat label="BTC Dominance" value={m ? <span className="num">{m.btcDominance != null ? `${m.btcDominance.toFixed(1)}%` : "—"}</span> : <Skeleton className="h-7 w-20" />} sub="ลดลง = เงินเริ่มหมุนเข้า Altcoin" />
        <Stat
          label="มาร์เก็ตแคปรวม 24 ชม."
          value={m ? (m.totalMarketCapChange24h != null ? <Pct v={m.totalMarketCapChange24h} /> : "—") : <Skeleton className="h-7 w-20" />}
          sub={m && `USDT/THB ${m.usdThb.toFixed(2)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title="ราคาตลาด"
          extra={
            tab !== "watch" && (
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(50);
                }}
                placeholder="กรองในตาราง…"
                className="w-32 rounded-lg border border-line bg-bg px-3 py-1.5 text-xs outline-none placeholder:text-dim focus:border-line-2 sm:w-44"
              />
            )
          }
        >
          <div className="mb-3">
            <Segmented
              value={tab}
              onChange={(v) => {
                setTab(v);
                setLimit(50);
              }}
              options={TABS.map((x) => ({ value: x.value, label: x.label }))}
            />
          </div>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-dim">
                  <th className="px-5 pb-2 font-normal">เหรียญ</th>
                  <th className="px-2 pb-2 text-right font-normal">ราคา</th>
                  <th className="px-2 pb-2 text-right font-normal">24 ชม.</th>
                  <th className="px-2 pb-2 text-right font-normal">วอลุ่ม</th>
                  <th className="whitespace-nowrap px-2 pb-2 text-right font-normal">มาร์เก็ตแคป</th>
                  <th className="px-5 pb-2 font-normal">กระดาน</th>
                </tr>
              </thead>
              <tbody>
                {!m &&
                  !emptyWatch &&
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-1.5">
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))}
                {((m && m.coins.length === 0) || emptyWatch) && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-dim">
                      {tab === "watch" ? "ยังไม่มีรายการโปรด — กด ☆ ในหน้าเหรียญเพื่อเพิ่ม" : "ไม่พบเหรียญ"}
                    </td>
                  </tr>
                )}
                {!emptyWatch && m?.coins.map((c) => (
                  <tr key={c.symbol} onClick={() => router.push(`/coin/${c.symbol}`)} className="cursor-pointer border-b border-line/60 transition-colors duration-200 hover:bg-white/[0.04]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CoinIcon src={c.image} symbol={c.symbol} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            {c.symbol}
                            {c.onBinanceTH && !c.exchanges.some((e) => e.ex === "binanceth") && (
                              <span title="ซื้อได้บน Binance TH (คู่ USDT)" className="rounded border border-up/30 px-1 text-[9px] font-normal leading-4 text-up/80">
                                TH
                              </span>
                            )}
                          </div>
                          <div className="max-w-[140px] truncate text-[11px] text-dim">{c.th ?? (c.name !== c.symbol ? c.name : "")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 text-right"><LivePrice value={c.price} /></td>
                    <td className="whitespace-nowrap px-2 text-right">
                      <Pct v={c.change24h} className="text-xs" />
                    </td>
                    <td className="num whitespace-nowrap px-2 text-right text-muted">{fmtCompactTHB(c.quoteVolume)}</td>
                    <td className="num whitespace-nowrap px-2 text-right text-muted">{c.marketCap ? fmtCompactTHB(c.marketCap) : "—"}</td>
                    <td className="min-w-[110px] px-5">
                      <ExchangeBadges list={c.exchanges} max={3} nowrap />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tab === "watch" && watchDex.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {watchDex.map((id) => (
                <Link key={id} href={`/coin/${encodeURIComponent(id)}`} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-fg">
                  DEX · {id.split(":")[1]} · {id.split(":")[2].slice(0, 8)}…
                </Link>
              ))}
            </div>
          )}
          {m && tab !== "watch" && (
            <div className="mt-3 flex items-center justify-between text-xs text-dim">
              <span>
                {m.coins.length.toLocaleString("th-TH")} จาก {m.total.toLocaleString("th-TH")} เหรียญ
              </span>
              {m.coins.length < m.total &&
                (limit < 200 ? (
                  <button onClick={() => setLimit((l) => l + 50)} className="rounded-lg border border-line px-3 py-1 text-muted hover:text-fg">
                    ดูเพิ่ม
                  </button>
                ) : (
                  <span>ใช้ช่องค้นหาเพื่อหาเหรียญอื่น</span>
                ))}
            </div>
          )}
        </Card>

        <Portfolio />
      </div>

      <Disclaimer />
    </main>
  );
}
