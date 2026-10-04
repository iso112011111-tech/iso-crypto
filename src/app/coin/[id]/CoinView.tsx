"use client";

import { useState } from "react";
import { useCoin } from "@/hooks/data";
import { toggleWatch, useUser } from "@/hooks/user";
import { CandleChart, Sparkline } from "@/components/Charts";
import AnalysisPanel from "@/components/AnalysisPanel";
import AiAnalysis from "@/components/AiAnalysis";
import LivePrice from "@/components/LivePrice";
import { ExchangeBadges, exName, rememberDex } from "@/components/CoinPicker";
import { Bar, ButtonLink, Card, CoinIcon, Disclaimer, ErrorBox, Notice, Pct, Segmented, Skeleton, btn } from "@/components/ui";
import { THAI_NAMES } from "@/lib/coins";
import { fmtCompactTHB, fmtPct, fmtTHB } from "@/lib/format";
import type { CoinResponse, Derivatives, DexSafety, Flow, MarketCoin, MultiTimeframe } from "@/lib/types";

const TREND_CLS = { up: "text-up", down: "text-down", side: "text-muted" } as const;
const NOTE_CLS = { good: "text-up", warn: "text-warn", bad: "text-down", info: "text-muted" } as const;

function Row({ k, v, cls = "" }: { k: React.ReactNode; v: React.ReactNode; cls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted">{k}</span>
      <span className={`num text-right ${cls}`}>{v}</span>
    </div>
  );
}

function MtfCard({ mtf }: { mtf: MultiTimeframe | null | undefined }) {
  return (
    <Card title="หลายกรอบเวลา">
      {!mtf ? (
        <p className="text-sm text-dim">ข้อมูลยังไม่พอ</p>
      ) : (
        <>
          <div className="divide-y divide-line">
            {mtf.rows.map((r) => (
              <Row
                key={r.tf}
                k={{ "4H": "4 ชั่วโมง (สั้น)", "1D": "รายวัน (หลัก)", "1W": "รายสัปดาห์ (ใหญ่)" }[r.tf]}
                v={
                  <span className={TREND_CLS[r.trend]}>
                    {r.note} <span className="text-dim">· RSI {r.rsi.toFixed(0)}</span>
                  </span>
                }
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed">{mtf.summary}</p>
        </>
      )}
    </Card>
  );
}

function FlowCard({ flow }: { flow: Flow | undefined }) {
  if (!flow) return null;
  return (
    <Card title="แรงซื้อขาย">
      <div className="divide-y divide-line">
        {flow.volSpike != null && <Row k="วอลุ่มเมื่อวาน เทียบปกติ" v={`${flow.volSpike.toFixed(1)} เท่า`} cls={flow.volSpike >= 3 ? "text-warn" : ""} />}
        {flow.takerBuy7d != null && (
          <div className="py-2">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">แรงกดซื้อ 7 วัน</span>
              <span className="num">{(flow.takerBuy7d * 100).toFixed(1)}%</span>
            </div>
            <Bar value={flow.takerBuy7d} color={flow.takerBuy7d >= 0.5 ? "var(--color-up)" : "var(--color-down)"} />
          </div>
        )}
        {flow.dexBuys24h != null && (
          <Row k="ธุรกรรม 24 ชม. (ซื้อ / ขาย)" v={`${flow.dexBuys24h.toLocaleString("th-TH")} / ${flow.dexSells24h?.toLocaleString("th-TH")}`} />
        )}
      </div>
      <ul className="mt-3 space-y-1 text-[13px] leading-relaxed">
        {flow.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Card>
  );
}

function FuturesCard({ d }: { d: Derivatives | null | undefined }) {
  return (
    <Card title="ตลาดฟิวเจอร์ส">
      {!d ? (
        <p className="text-sm text-dim">เหรียญนี้ไม่มีสัญญาฟิวเจอร์สบน Binance / Bybit / OKX</p>
      ) : (
        <>
          <div className="divide-y divide-line">
            {d.fundingAvg != null && (
              <Row
                k="Funding เฉลี่ย / 8 ชม."
                v={`${d.fundingAvg >= 0 ? "+" : ""}${d.fundingAvg.toFixed(4)}%`}
                cls={d.fundingAvg > 0.03 ? "text-down" : d.fundingAvg < -0.01 ? "text-up" : ""}
              />
            )}
            {d.oiUsd != null && <Row k="Open Interest" v={`$${(d.oiUsd / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`} />}
            {d.oiChange7d != null && <Row k="OI เปลี่ยน 7 วัน" v={fmtPct(d.oiChange7d, 1)} cls={d.oiChange7d >= 0 ? "text-up" : "text-down"} />}
            {d.longShort != null && <Row k="บัญชี Long ÷ Short" v={d.longShort.toFixed(2)} />}
          </div>
          {d.oiHistory.length > 5 && (
            <div className="mt-3">
              <div className="mb-1 text-[11px] text-dim">Open Interest 30 วัน</div>
              <Sparkline values={d.oiHistory} height={32} />
            </div>
          )}
          <ul className="mt-3 space-y-1 text-[13px] leading-relaxed">
            {d.notes.map((n) => (
              <li key={n.text} className={NOTE_CLS[n.tone]}>
                {n.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ExchangesCard({ m }: { m: MarketCoin }) {
  const prices = m.exchanges.map((e) => e.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return (
    <Card title="ราคาแต่ละกระดาน" extra={<ExchangeBadges list={m.exchanges} />}>
      <div className="divide-y divide-line">
        {m.exchanges.map((e) => (
          <div key={e.ex} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-24 whitespace-nowrap text-muted">{exName(e.ex)}</span>
            <span className={`num ml-auto ${prices.length > 1 && e.price === lo ? "text-up" : prices.length > 1 && e.price === hi ? "text-down" : ""}`}>{fmtTHB(e.price)}</span>
            <span className="num w-24 text-right text-xs text-dim">{fmtCompactTHB(e.volume)}</span>
          </div>
        ))}
      </div>
      {prices.length > 1 && <p className="mt-3 text-xs text-dim">ถูกสุด–แพงสุดต่างกัน {fmtPct((hi / lo - 1) * 100)}</p>}
      {(
        [
          ["Bitkub", m.bitkubPremium],
          ["Binance TH", m.binanceThPremium],
        ] as const
      ).map(([name, p]) =>
        p == null ? null : (
          <p key={name} className={`mt-2 text-[13px] ${Math.abs(p) > 1.5 ? "text-warn" : "text-muted"}`}>
            {name} {p >= 0 ? "แพงกว่า" : "ถูกกว่า"}ตลาดโลก {fmtPct(Math.abs(p))}
            {p > 1.5 ? " — คนไทยไล่ซื้อแรง ระวังซื้อแพง" : p < -1.5 ? " — คนไทยเทขาย อาจได้ของถูก" : ""}
          </p>
        ),
      )}
      {m.onBinanceTH && !m.exchanges.some((e) => e.ex === "binanceth") && (
        <p className="mt-2 text-[13px] text-muted">ซื้อได้บน Binance TH ผ่านคู่ USDT (ราคาเดียวกับ Binance)</p>
      )}
    </Card>
  );
}

function SafetyCard({ s }: { s: DexSafety }) {
  const color = s.score >= 70 ? "text-up" : s.score >= 40 ? "text-warn" : "text-down";
  const icon = { ok: "✓", warn: "!", bad: "✕" } as const;
  const iconCls = { ok: "text-up", warn: "text-warn", bad: "text-down" } as const;
  return (
    <Card title="ความปลอดภัยของเหรียญ DEX">
      <div className="flex items-baseline gap-3">
        <span className={`num text-3xl font-semibold ${color}`}>{s.score}</span>
        <span className={`text-sm ${color}`}>{s.level}</span>
        {s.holders != null && <span className="ml-auto text-xs text-dim">{s.holders.toLocaleString("th-TH")} กระเป๋า</span>}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {s.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 py-2 text-sm">
            <span className={`w-3 font-semibold ${iconCls[c.status]}`}>{icon[c.status]}</span>
            <span className="text-muted">{c.label}</span>
            <span className="ml-auto text-right text-[13px]">{c.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-dim">ตรวจสัญญาโดย GoPlus Security · ผ่านทุกข้อก็ยังไม่ได้แปลว่าปลอดภัย 100%</p>
    </Card>
  );
}

function DexCard({ d, usdThb }: { d: NonNullable<CoinResponse["dex"]>; usdThb: number }) {
  return (
    <Card title={`ข้อมูล DEX · ${d.chainName}`}>
      <div className="divide-y divide-line">
        <Row k="สภาพคล่องรวม" v={fmtCompactTHB(d.liquidity)} cls={d.liquidity / usdThb < 50_000 ? "text-warn" : ""} />
        <Row k="วอลุ่ม 24 ชม." v={fmtCompactTHB(d.volume24h)} />
        {d.marketCap && <Row k="มูลค่าเหรียญทั้งหมด" v={fmtCompactTHB(d.marketCap)} />}
        <Row k="จำนวนพูล" v={`${d.pools} พูล · ใหญ่สุดบน ${d.dexId}`} />
        {d.createdAt && <Row k="เปิดพูลแรก" v={new Date(d.createdAt).toLocaleDateString("th-TH", { dateStyle: "medium" })} />}
      </div>
      <div className="mt-4 text-xs text-dim">ถ้าขายตอนนี้ ราคาจะไหลประมาณ</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {d.slippage.map((x) => (
          <div key={x.amount} className="rounded-lg border border-line p-2.5 text-center">
            <div className="text-[11px] text-dim">ขาย {fmtTHB(x.amount)}</div>
            <div className={`num mt-0.5 text-sm ${x.impactPct > 5 ? "text-down" : x.impactPct > 1 ? "text-warn" : "text-up"}`}>−{x.impactPct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
      <p className="mt-3 break-all text-[11px] text-dim">คอนแทรกต์ {d.address}</p>
    </Card>
  );
}

export default function CoinView({ id }: { id: string }) {
  const [range, setRange] = useState(150);
  const coin = useCoin(id, 60_000);
  const user = useUser();
  const d = coin.data;
  const a = d?.analysis;
  if (d?.dex) rememberDex(d.dex);

  const symbol = d?.dex?.symbol ?? d?.market?.symbol ?? id.toUpperCase();
  const name = d?.dex ? d.dex.name : d?.market ? (THAI_NAMES[d.market.symbol] ?? d.market.name) : "";
  const price = d?.dex?.price ?? d?.market?.price ?? a?.price;
  const change = d?.dex?.change24h ?? d?.market?.change24h;
  const watched = user.data.watchlist.includes(d?.id ?? id);

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-3">
          <CoinIcon src={d?.dex?.image ?? d?.market?.image} symbol={symbol} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{symbol}</h1>
              {d?.dex && <span className="rounded border border-line-2 px-1.5 text-[10px] text-muted">DEX · {d.dex.chainName}</span>}
            </div>
            <div className="text-sm text-dim">{name}</div>
          </div>
        </div>
        {price != null && (
          <div className="flex items-baseline gap-3">
            <LivePrice value={price} className="text-2xl" />
            {change != null && <Pct v={change} className="text-sm" />}
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => toggleWatch(d?.id ?? id)} className={btn.ghost} aria-pressed={watched}>
            <span className={watched ? "text-accent" : ""}>{watched ? "★" : "☆"}</span>
            {watched ? "อยู่ในรายการโปรด" : "เพิ่มรายการโปรด"}
          </button>
          {a && (
            <>
              <ButtonLink href={`/journal?add=${encodeURIComponent(d!.id)}`} variant="ghost">
                บันทึกเทรด
              </ButtonLink>
              <ButtonLink href={`/allocator?id=${encodeURIComponent(d!.id)}`}>วางแผนแบ่งไม้</ButtonLink>
            </>
          )}
        </div>
      </div>

      {coin.error && <ErrorBox msg={coin.error} onRetry={coin.reload} />}
      {d?.notice && (
        <div className="mb-4">
          <Notice>{d.notice}</Notice>
        </div>
      )}
      {d?.dex && d.dex.safety.score < 40 && (
        <div className="mb-4">
          <Notice tone="bad">⚠ เหรียญนี้มีสัญญาณอันตราย (คะแนนความปลอดภัย {d.dex.safety.score}/100) — ดูรายละเอียดด้านล่างก่อนตัดสินใจ</Notice>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title={d ? `แหล่งกราฟ: ${d.source}` : "กราฟราคา"}
          extra={
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: 60, label: "2 เดือน" },
                { value: 150, label: "5 เดือน" },
                { value: 365, label: "1 ปี" },
                { value: 1000, label: "ทั้งหมด" },
              ]}
            />
          }
        >
          {d && d.candles.length > 0 ? (
            <CandleChart
              candles={d.candles}
              range={range}
              height={380}
              levels={
                a
                  ? [
                      ...a.supports.slice(0, 2).map((p, i) => ({ price: p, label: `S${i + 1} ${fmtTHB(p)}`, color: "#34d399", dashed: true })),
                      ...a.resistances.slice(0, 2).map((p, i) => ({ price: p, label: `R${i + 1} ${fmtTHB(p)}`, color: "#fb7185", dashed: true })),
                    ]
                  : []
              }
            />
          ) : (
            !coin.error && (d ? <p className="py-20 text-center text-sm text-dim">ไม่มีกราฟย้อนหลัง</p> : <Skeleton className="h-[380px]" />)
          )}
          {a && (
            <div className="mt-4 grid grid-cols-2 divide-line border-t border-line pt-4 text-sm sm:grid-cols-4 sm:divide-x">
              {[
                ["RSI", a.rsi.toFixed(0)],
                ["แกว่ง/วัน", `${a.atrPct.toFixed(1)}%`],
                ["7 วัน", fmtPct(a.change7d, 1)],
                ["30 วัน", fmtPct(a.change30d, 1)],
              ].map(([k, v]) => (
                <div key={k} className="px-3 py-1 first:pl-0">
                  <div className="text-[11px] text-dim">{k}</div>
                  <div className="num">{v}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="บทวิเคราะห์">
          {a ? <AnalysisPanel a={a} /> : d ? <p className="text-sm text-dim">ข้อมูลยังไม่พอสำหรับการวิเคราะห์</p> : <Skeleton className="h-[440px]" />}
        </Card>
      </div>

      {d && (d.analysis || d.dex) && (
        <div className="mt-4">
          <AiAnalysis id={d.id} symbol={symbol} />
        </div>
      )}

      {d && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MtfCard mtf={d.mtf} />
          <FlowCard flow={d.flow} />
          {d.dex ? <SafetyCard s={d.dex.safety} /> : <FuturesCard d={d.derivatives} />}
          {d.dex ? <DexCard d={d.dex} usdThb={d.usdThb} /> : d.market && <ExchangesCard m={d.market} />}
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
