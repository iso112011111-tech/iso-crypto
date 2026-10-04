"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useScan } from "@/hooks/data";
import { Card, CoinIcon, Disclaimer, ErrorBox, PageTitle, Segmented, Skeleton, ToneBadge, scoreColor, toneOf } from "@/components/ui";
import { fmtPct, fmtTHB } from "@/lib/format";
import type { Analysis, ScanRow } from "@/lib/types";

type Filter = "all" | Analysis["verdict"]["tone"];
type Sort = "score" | "rrr" | "risk" | "volume";

/** Risk Matrix: แกน X = ความผันผวน, แกน Y = คะแนน — มุมซ้ายบนคือจุดที่น่าสนใจที่สุด */
function RiskMatrix({ rows }: { rows: ScanRow[] }) {
  const W = 640;
  const H = 320;
  const pad = { l: 36, r: 16, t: 14, b: 30 };
  const vMax = Math.min(250, Math.max(100, ...rows.map((r) => r.analysis.volatility)) * 1.08);
  const x = (v: number) => pad.l + (Math.min(v, vMax) / vMax) * (W - pad.l - pad.r);
  const y = (s: number) => pad.t + (1 - s / 100) * (H - pad.t - pad.b);
  const midX = x(vMax / 2);
  const midY = y(60);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect x={pad.l} y={pad.t} width={midX - pad.l} height={midY - pad.t} fill="#34d399" opacity={0.04} />
      <line x1={midX} x2={midX} y1={pad.t} y2={H - pad.b} stroke="#2a3070" />
      <line x1={pad.l} x2={W - pad.r} y1={midY} y2={midY} stroke="#2a3070" />
      <text x={pad.l + 8} y={pad.t + 14} fontSize={10.5} fill="#34d399">นิ่ง + คะแนนดี</text>
      <text x={W - pad.r - 8} y={pad.t + 14} fontSize={10.5} fill="#a3a9d6" textAnchor="end">คะแนนดี แต่แกว่งแรง</text>
      <text x={W - pad.r - 8} y={H - pad.b - 8} fontSize={10.5} fill="#8b7cff" textAnchor="end">โซนอันตราย</text>
      {[0, 50, 100].map((s) => (
        <text key={s} x={pad.l - 6} y={y(s) + 4} fontSize={10} fill="#6c73a8" textAnchor="end">
          {s}
        </text>
      ))}
      <text x={(W + pad.l) / 2} y={H - 8} fontSize={10.5} fill="#6c73a8" textAnchor="middle">
        ความผันผวนรายปี → เสี่ยงมากขึ้น
      </text>
      {rows.map((r, i) => {
        const a = r.analysis;
        const col = scoreColor(a.score);
        return (
          <Link key={r.symbol} href={`/coin/${r.symbol}`}>
            <title>{`${r.symbol} · คะแนน ${a.score}`}</title>
            <circle cx={x(a.volatility)} cy={y(a.score)} r={i < 30 ? 5 : 3.5} fill={col} fillOpacity={0.85} />
            {i < 15 && (
              <text x={x(a.volatility) + 8} y={y(a.score) + 3.5} fontSize={10} fill="#c7cbee">
                {r.symbol}
              </text>
            )}
          </Link>
        );
      })}
    </svg>
  );
}

const SETS = [
  { value: "top50", label: "วอลุ่ม Top 50" },
  { value: "top150", label: "Top 150" },
  { value: "movers", label: "มาแรง" },
  { value: "small", label: "เหรียญเล็ก/ใหม่" },
  { value: "bitkub", label: "มีบน Bitkub" },
  { value: "binanceth", label: "มีบน Binance TH" },
];
const RISK_ORDER = { ต่ำ: 0, ปานกลาง: 1, สูง: 2, สูงมาก: 3 };

export default function Scanner() {
  const [set, setSet] = useState("top50");
  const scan = useScan(set);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("score");

  const rows = useMemo(() => {
    const list = (scan.data?.rows ?? []).filter((r) => filter === "all" || r.analysis.verdict.tone === filter);
    return [...list].sort((p, q) =>
      sort === "score"
        ? q.analysis.score - p.analysis.score
        : sort === "rrr"
          ? q.analysis.trade.rrr - p.analysis.trade.rrr
          : sort === "volume"
            ? q.analysis.volRatio - p.analysis.volRatio
            : RISK_ORDER[p.analysis.risk] - RISK_ORDER[q.analysis.risk],
    );
  }, [scan.data, filter, sort]);

  return (
    <main>
      <PageTitle
        title="สแกนหาจังหวะ"
        sub="ให้คะแนนทุกเหรียญจากปัจจัยที่ทดสอบย้อนหลังแล้วว่าช่วยได้จริง (ความนิ่ง ความแข็งแรง วอลุ่ม ไม่ใช่มีดตก โมเมนตัม แนวโน้ม)"
        right={
          <Link href="/accuracy" className="text-xs text-muted hover:text-fg">
            ดูผลทดสอบความแม่นยำ →
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={set} onChange={setSet} options={SETS} />
        <span className="text-xs text-dim">
          {scan.loading ? "กำลังสแกน…" : scan.data && `${scan.data.rows.length} เหรียญ${scan.data.skipped ? ` · ข้าม ${scan.data.skipped} ที่ข้อมูลน้อย` : ""}`}
        </span>
      </div>

      {scan.error && <ErrorBox msg={scan.error} onRetry={scan.reload} />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="order-2 xl:order-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "good", label: "น่าสะสม" },
                { value: "ok", label: "ทยอยได้" },
                { value: "wait", label: "รอดู" },
                { value: "bad", label: "ยังไม่ใช่" },
              ]}
            />
            <Segmented
              value={sort}
              onChange={setSort}
              options={[
                { value: "score", label: "คะแนน" },
                { value: "rrr", label: "เสี่ยง:ได้" },
                { value: "volume", label: "วอลุ่มพุ่ง" },
                { value: "risk", label: "เสี่ยงน้อย" },
              ]}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            {!scan.data && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="m-3 h-12" />)}
            {scan.data && rows.length === 0 && <p className="py-10 text-center text-sm text-dim">ไม่มีเหรียญในกลุ่มนี้</p>}
            <ul className="divide-y divide-line">
              {rows.map((r, i) => {
                const a = r.analysis;
                return (
                  <li key={r.symbol}>
                    <Link href={`/coin/${r.symbol}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition hover:bg-panel-2">
                      <span className="num w-5 text-xs text-dim">{i + 1}</span>
                      <div className="flex w-36 items-center gap-2.5">
                        <CoinIcon src={r.image} symbol={r.symbol} />
                        <div className="min-w-0">
                          <div className="font-medium">{r.symbol}</div>
                          <div className="truncate text-[11px] text-dim">{r.th ?? (r.name !== r.symbol ? r.name : "")}</div>
                        </div>
                      </div>
                      <div className="num w-10 text-lg font-semibold" style={{ color: scoreColor(a.score) }}>
                        {a.score}
                      </div>
                      <div className="hidden w-24 text-right sm:block">
                        <div className="num text-sm">{fmtTHB(a.price)}</div>
                        <div className={`num text-[11px] ${a.change7d >= 0 ? "text-up" : "text-down"}`}>7 วัน {fmtPct(a.change7d, 1)}</div>
                      </div>
                      <div className="w-16 text-xs">
                        <div className="text-dim">เสี่ยง:ได้</div>
                        <div className="num">1:{a.trade.rrr.toFixed(1)}</div>
                      </div>
                      <div className="w-14 text-xs">
                        <div className="text-dim">ความเสี่ยง</div>
                        <div>{a.risk}</div>
                      </div>
                      <p className={`min-w-[180px] flex-1 text-[13px] leading-snug ${toneOf(a.verdict.tone).text}`}>{a.verdict.headline}</p>
                      <ToneBadge tone={a.verdict.tone} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          <Card title="แผนที่ความเสี่ยง">{scan.data ? <RiskMatrix rows={scan.data.rows} /> : <Skeleton className="aspect-[2/1]" />}</Card>
          <Card title="คะแนนคิดจากอะไร">
            <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
              <li><b className="text-fg">ความนิ่ง 25</b> — แกว่งน้อย = ควบคุมความเสี่ยงง่าย ทดสอบแล้วได้ผลดีที่สุด</li>
              <li><b className="text-fg">ความแข็งแรง 20</b> — ราคายืนใกล้จุดสูงสุด 90 วัน</li>
              <li><b className="text-fg">ไม่ใช่มีดตก 20</b> — ไม่ได้ร่วงหนักใน 7/30 วัน</li>
              <li><b className="text-fg">วอลุ่ม 15</b> — เงินไหลเข้ามากกว่าปกติ</li>
              <li><b className="text-fg">โมเมนตัม 10 · แนวโน้ม 10</b> — RSI เหนือ 50 และไม่อยู่ในขาลง</li>
            </ul>
            <p className="mt-3 text-xs text-dim">คะแนนสูง = สถิติได้เปรียบ ไม่ใช่การันตีว่าราคาจะขึ้น</p>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </main>
  );
}
