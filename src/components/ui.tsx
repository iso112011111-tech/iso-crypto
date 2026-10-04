import Link from "next/link";
import type { ReactNode } from "react";
import type { Analysis } from "@/lib/types";

export function Card({ title, extra, className = "", children }: { title?: ReactNode; extra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`glass glow-card rise min-w-0 rounded-2xl p-5 ${className}`}>
      {(title || extra) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-medium text-muted">{title}</h2>}
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, className = "" }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`glass glow-card rise rounded-2xl p-4 ${className}`}>
      <div className="text-xs text-dim">{label}</div>
      <div className="mt-1.5 text-lg font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

export function Pct({ v, className = "" }: { v: number; className?: string }) {
  return (
    <span className={`num ${v >= 0 ? "text-up" : "text-down"} ${className}`}>
      {v >= 0 ? "+" : "−"}
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-[#0b1030]/60 p-1 backdrop-blur">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-xs transition-all duration-300 ${value === o.value ? "bg-gradient-to-r from-[#6366f1]/80 to-[#8b7cff]/80 text-white shadow-[0_4px_16px_-6px_rgba(124,115,255,0.9)]" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";
export const btn = {
  primary: `${btnBase} btn-glow text-white`,
  ghost: `${btnBase} border border-line bg-[#0b1030]/40 text-fg backdrop-blur hover:border-line-2 hover:bg-panel-2`,
};

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: keyof typeof btn }) {
  return (
    <Link href={href} className={btn[variant]}>
      {children}
    </Link>
  );
}

const TONE = {
  good: { text: "text-up", dot: "bg-up", tag: "น่าสะสม" },
  ok: { text: "text-fg", dot: "bg-fg", tag: "ทยอยได้" },
  wait: { text: "text-warn", dot: "bg-warn", tag: "รอดูก่อน" },
  bad: { text: "text-down", dot: "bg-down", tag: "ยังไม่ใช่" },
} as const;

export const toneOf = (t: Analysis["verdict"]["tone"]) => TONE[t];

export function ToneBadge({ tone }: { tone: Analysis["verdict"]["tone"] }) {
  const s = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.tag}
    </span>
  );
}

export const scoreColor = (score: number) => (score >= 75 ? "#34d399" : score >= 60 ? "#eef0ff" : score >= 45 ? "#fbbf24" : "#fb7185");

export function ScoreRing({ score, size = 84 }: { score: number; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(170 180 255 / 0.14)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 1s cubic-bezier(.2,.7,.2,1)", filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="text-center leading-none">
        <div className="num text-2xl font-semibold">{score}</div>
        <div className="mt-1 text-[10px] text-dim">/100</div>
      </div>
    </div>
  );
}

export function Bar({ value, max = 1, color = "var(--color-fg)" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }} />
    </div>
  );
}

export function FactorBars({ factors }: { factors: Analysis["factors"] }) {
  return (
    <ul className="space-y-3">
      {factors.map((f) => (
        <li key={f.key}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span>{f.label}</span>
            <span className="num text-dim">
              {f.points}/{f.max}
            </span>
          </div>
          <Bar value={f.points} max={f.max} color={f.points / f.max >= 0.7 ? "var(--color-fg)" : f.points / f.max >= 0.4 ? "#8f96c8" : "var(--color-accent)"} />
          <div className="mt-1 text-[11px] text-dim">{f.note}</div>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`scanline rounded-xl bg-panel-2/60 ${className}`} />;
}

export function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="glass rounded-xl border-down/30 p-4 text-sm text-down">
      {msg}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline">
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" | "bad" }) {
  const cls = tone === "bad" ? "border-down/30 text-down" : tone === "info" ? "border-line text-muted" : "border-warn/30 text-warn";
  return <div className={`glass rounded-xl p-4 text-sm leading-relaxed ${cls}`}>{children}</div>;
}

export function Disclaimer() {
  return (
    <p className="mt-10 border-t border-line pt-4 text-center text-xs leading-relaxed text-dim">
      ผลวิเคราะห์คำนวณจากข้อมูลย้อนหลัง ไม่มีระบบใดทำนายราคาได้ 100% · คริปโตเสี่ยงสูง ใช้เงินเย็นและตัดสินใจเอง · ไม่ใช่คำแนะนำการลงทุน
    </p>
  );
}

/** โลโก้เหรียญ หรือวงกลมตัวอักษรถ้าไม่มีรูป */
export function CoinIcon({ src, symbol, size = 24 }: { src?: string; symbol: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-panel-2" loading="lazy" />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-panel-2 text-[10px] text-muted" style={{ width: size, height: size }}>
      {symbol.slice(0, 1)}
    </span>
  );
}
