"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/types";
import { ema } from "@/lib/indicators";
import { fmtTHB } from "@/lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const dateTH = (t: number) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export type Level = { price: number; label: string; color: string; dashed?: boolean };

const EMAS = [
  { p: 20, color: "#dfe3ff", label: "EMA20" },
  { p: 50, color: "#8088c0", label: "EMA50" },
  { p: 200, color: "#8b7cff", label: "EMA200" },
];

/** กราฟแท่งเทียน SVG น้ำหนักเบา พร้อมเส้น EMA, แนวรับ/แนวต้าน และ crosshair */
export function CandleChart({ candles, range = 120, levels = [], height = 340 }: { candles: Candle[]; range?: number; levels?: Level[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const clipId = "clip" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const { data, emaLines } = useMemo(() => {
    const closes = candles.map((c) => c.c);
    const start = Math.max(0, candles.length - range);
    return {
      data: candles.slice(start),
      emaLines: EMAS.map((e) => ({ ...e, values: ema(closes, e.p).slice(start) })),
    };
  }, [candles, range]);

  const padR = 100;
  const padT = 12;
  const padB = 24;
  const plotW = Math.max(0, width - padR);
  const plotH = height - padT - padB;

  // ไส้เทียนที่พุ่งผิดปกติ (เช่น ราคากระชากบน DEX) จะถูกตัดขอบ ไม่ให้บีบกราฟทั้งเส้นจนแบน
  const closes = data.map((c) => c.c);
  const cMax = Math.max(...closes);
  const cMin = Math.min(...closes);
  const lo0 = Math.max(Math.min(...data.map((c) => c.l)), cMin / 2);
  const hi0 = Math.min(Math.max(...data.map((c) => c.h)), cMax * 2);
  // ขยายแกนให้เห็นเส้นแผน แต่ไม่ให้เส้นที่ไกลมากบีบกราฟจนแบน
  const span = hi0 - lo0;
  const visibleLevels = levels.filter((l) => l.price > lo0 - span * 0.6 && l.price < hi0 + span * 0.6);
  const lo = Math.min(lo0, ...visibleLevels.map((l) => l.price)) * 0.995;
  const hi = Math.max(hi0, ...visibleLevels.map((l) => l.price)) * 1.005;

  const x = (i: number) => (i + 0.5) * (plotW / data.length);
  const y = (p: number) => padT + (1 - (p - lo) / (hi - lo)) * plotH;
  const bw = Math.min(14, Math.max(1, (plotW / data.length) * 0.62));
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const hc = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.floor(((e.clientX - r.left) / plotW) * data.length);
            setHover(i >= 0 && i < data.length ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="#1c2252" />
              <text x={plotW + 6} y={y(t) + 4} fontSize={10} fill="#6c73a8" className="num">
                {fmtTHB(t)}
              </text>
            </g>
          ))}

          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={padT} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
          {data.map((c, i) => {
            const up = c.c >= c.o;
            const col = up ? "#34d399" : "#fb7185";
            return (
              <g key={c.t}>
                <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeOpacity={0.7} />
                <rect
                  x={x(i) - bw / 2}
                  width={bw}
                  y={y(Math.max(c.o, c.c))}
                  height={Math.max(1, Math.abs(y(c.o) - y(c.c)))}
                  fill={up ? col : col}
                  fillOpacity={up ? 0.85 : 0.75}
                  rx={1}
                />
              </g>
            );
          })}

          </g>
          {emaLines.map((e) => {
            const pts = e.values.map((v, i) => (Number.isFinite(v) ? `${x(i)},${y(v)}` : null)).filter(Boolean);
            return pts.length > 1 ? (
              <polyline key={e.p} points={pts.join(" ")} fill="none" stroke={e.color} strokeWidth={1.4} strokeOpacity={0.85} clipPath={`url(#${clipId})`} />
            ) : null;
          })}

          {visibleLevels.map((l) => (
            <g key={l.label + l.price}>
              <line x1={0} x2={plotW} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeDasharray={l.dashed ? "5 4" : undefined} strokeOpacity={0.8} />
              <rect x={plotW + 2} y={y(l.price) - 9} width={padR - 4} height={18} rx={5} fill={l.color} fillOpacity={0.18} />
              <text x={plotW + 6} y={y(l.price) + 4} fontSize={10} fill={l.color} className="num">
                {l.label}
              </text>
            </g>
          ))}

          {hc && hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="#4b5294" strokeDasharray="3 3" />
          )}

          <text x={4} y={height - 6} fontSize={10} fill="#6c73a8">
            {dateTH(data[0].t)}
          </text>
          <text x={plotW - 4} y={height - 6} fontSize={10} fill="#6c73a8" textAnchor="end">
            {dateTH(data[data.length - 1].t)}
          </text>
        </svg>
      )}

      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-bg/80 px-2 py-1 text-[11px] backdrop-blur">
        {hc ? (
          <>
            <span className="text-muted">{dateTH(hc.t)}</span>
            <span>O <b className="num font-normal">{fmtTHB(hc.o)}</b></span>
            <span>H <b className="num font-normal text-up">{fmtTHB(hc.h)}</b></span>
            <span>L <b className="num font-normal text-down">{fmtTHB(hc.l)}</b></span>
            <span>C <b className="num font-normal">{fmtTHB(hc.c)}</b></span>
          </>
        ) : (
          EMAS.map((e) => (
            <span key={e.p} style={{ color: e.color }}>
              ━ {e.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export type Series = { label: string; color: string; values: number[]; dashed?: boolean };

/** กราฟเส้นหลายชุด (ใช้กับผล Backtest) */
export function LineChart({ times, series, height = 280 }: { times: number[]; series: Series[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padR = 100;
  const padT = 10;
  const padB = 24;
  const plotW = Math.max(0, width - padR);
  const plotH = height - padT - padB;
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const lo = Math.min(...all) * 0.98;
  const hi = Math.max(...all) * 1.02;
  const n = times.length;
  const x = (i: number) => (i / Math.max(1, n - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * plotH;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 1 && (
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / plotW) * (n - 1));
            setHover(i >= 0 && i < n ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="#1c2252" />
              <text x={plotW + 6} y={y(t) + 4} fontSize={10} fill="#6c73a8" className="num">
                {fmtTHB(t)}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <polyline
              key={s.label}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.2 : 1.8}
              strokeDasharray={s.dashed ? "4 4" : undefined}
            />
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="#4b5294" strokeDasharray="3 3" />}
          <text x={4} y={height - 6} fontSize={10} fill="#6c73a8">{dateTH(times[0])}</text>
          <text x={plotW - 4} y={height - 6} fontSize={10} fill="#6c73a8" textAnchor="end">{dateTH(times[n - 1])}</text>
        </svg>
      )}
      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-bg/80 px-2 py-1 text-[11px] backdrop-blur">
        {hover != null && <span className="text-muted">{dateTH(times[hover])}</span>}
        {series.map((s) => (
          <span key={s.label} style={{ color: s.color }}>
            ━ {s.label}
            {hover != null && <b className="num ml-1 font-normal">{fmtTHB(s.values[hover])}</b>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** เกจครึ่งวงกลมสำหรับ Fear & Greed */
export function Gauge({ value }: { value: number }) {
  const angle = Math.PI * (1 - value / 100);
  const nx = 60 + 44 * Math.cos(angle);
  const ny = 60 - 44 * Math.sin(angle);
  return (
    <svg viewBox="0 0 120 68" className="w-full max-w-[150px]">
      <defs>
        <linearGradient id="fg" x1="0" x2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset=".5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="url(#fg)" strokeWidth={8} strokeLinecap="round" opacity={0.9} />
      <line x1={60} y1={60} x2={nx} y2={ny} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={60} cy={60} r={4} fill="#fff" />
    </svg>
  );
}

export function Sparkline({ values, color = "#a3a9d6", height = 36 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${height - ((v - lo) / (hi - lo || 1)) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
