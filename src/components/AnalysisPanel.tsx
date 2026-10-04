import type { Analysis } from "@/lib/types";
import { fmtTHB, fmtPct } from "@/lib/format";
import { FactorBars, ScoreRing, ToneBadge, toneOf } from "./ui";

/** สรุปผลวิเคราะห์เหรียญเดียว: คะแนน, คำแนะนำ, จุดเข้า/SL/TP */
export default function AnalysisPanel({ a, compact = false }: { a: Analysis; compact?: boolean }) {
  const tone = toneOf(a.verdict.tone);
  const t = a.trade;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ScoreRing score={a.score} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={a.verdict.tone} />
            <span className="text-xs text-dim">ความเสี่ยง {a.risk}</span>
          </div>
          <p className={`mt-2 text-[15px] font-medium leading-snug ${tone.text}`}>{a.verdict.headline}</p>
        </div>
      </div>

      <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted">
        {a.verdict.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
            {b}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
        <div className="p-3">
          <div className="text-[11px] text-dim">ตัดขาดทุน</div>
          <div className="num mt-0.5 text-sm text-down">{fmtTHB(t.stopLoss)}</div>
          <div className="num text-[11px] text-dim">{fmtPct((t.stopLoss / t.entry - 1) * 100, 1)}</div>
        </div>
        <div className="p-3">
          <div className="text-[11px] text-dim">เป้ากำไร</div>
          <div className="num mt-0.5 text-sm text-up">{fmtTHB(t.takeProfit)}</div>
          <div className="num text-[11px] text-dim">{fmtPct((t.takeProfit / t.entry - 1) * 100, 1)}</div>
        </div>
        <div className="p-3">
          <div className="text-[11px] text-dim">เสี่ยง : ได้</div>
          <div className={`num mt-0.5 text-sm ${t.rrr >= 2 ? "text-up" : t.rrr >= 1.2 ? "text-fg" : "text-down"}`}>1 : {t.rrr.toFixed(1)}</div>
          <div className="text-[11px] text-dim">{t.rrr >= 2 ? "คุ้ม" : t.rrr >= 1.2 ? "พอใช้" : "ไม่คุ้ม"}</div>
        </div>
      </div>

      {!compact && (
        <div>
          <div className="mb-3 text-xs text-dim">คะแนนมาจาก</div>
          <FactorBars factors={a.factors} />
        </div>
      )}
    </div>
  );
}
