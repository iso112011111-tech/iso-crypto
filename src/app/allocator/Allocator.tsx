"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCoin } from "@/hooks/data";
import { updateData } from "@/hooks/user";
import { buildPlan, type AllocationPlan } from "@/lib/allocator";
import { fmtPct, fmtQty, fmtTHB } from "@/lib/format";
import { CandleChart } from "@/components/Charts";
import CoinPicker from "@/components/CoinPicker";
import { Card, Disclaimer, ErrorBox, Notice, PageTitle, Skeleton, ToneBadge, btn } from "@/components/ui";

const PRESETS = [10_000, 50_000, 100_000, 500_000];

function planText(symbol: string, p: AllocationPlan) {
  return [
    `แผนแบ่งไม้ ${symbol} · ทุน ${fmtTHB(p.capital)} (iso-crypto)`,
    ...p.tranches.map((t) => `${t.label}: ${fmtTHB(t.amount)} @ ${fmtTHB(t.price)} [${t.orderType}]`),
    `Stop Loss: ${fmtTHB(p.stopLoss)} (${fmtPct(p.stopLossPct, 1)})`,
    `TP1: ${fmtTHB(p.tp1)} (${fmtPct(p.tp1Pct, 1)}) · TP2: ${fmtTHB(p.tp2)} (${fmtPct(p.tp2Pct, 1)})`,
    `ถ้าไม้ 3 เข้า เลื่อน SL ขึ้นเป็น ${fmtTHB(p.trailStop)}`,
  ].join("\n");
}

function Field({ label, value, onChange, suffix, step }: { label: string; value: number; onChange: (v: number) => void; suffix: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-dim">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-line bg-bg focus-within:border-line-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="num w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
        <span className="pr-3 text-xs text-dim">{suffix}</span>
      </div>
    </label>
  );
}

export default function Allocator({ initialId }: { initialId: string }) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [capital, setCapital] = useState(100_000);
  const [fee, setFee] = useState(0.25);
  const [maxRisk, setMaxRisk] = useState(5);
  const [copied, setCopied] = useState(false);
  const coin = useCoin(id);
  const a = coin.data?.analysis;
  const symbol = coin.data?.dex?.symbol ?? coin.data?.market?.symbol ?? id;

  const plan = useMemo(() => (a && capital > 0 ? buildPlan(capital, a, fee || 0, maxRisk || 0) : null), [a, capital, fee, maxRisk]);

  const copy = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(planText(symbol, plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* เบราว์เซอร์ไม่อนุญาตให้คัดลอก */
    }
  };

  /** บันทึกไม้ 1 (ซื้อทันที) ลงสมุดเทรด พร้อมโน้ตคำสั่งที่ยังรออยู่ */
  const saveToJournal = () => {
    if (!plan || !a || !coin.data) return;
    const t1 = plan.tranches[0];
    updateData((d) => ({
      ...d,
      journal: [
        {
          id: crypto.randomUUID(),
          assetId: coin.data!.id,
          symbol,
          entry: t1.price,
          qty: t1.qty,
          sl: plan.stopLoss,
          tp: plan.tp1,
          openedAt: Date.now(),
          feePct: fee || 0,
          setupScore: a.score,
          note: `จากแผนแบ่งไม้ ทุน ${fmtTHB(plan.capital)} · รอ: ไม้ 2 ${fmtTHB(plan.tranches[1].amount)} @ ${fmtTHB(plan.tranches[1].price)}, ไม้ 3 ${fmtTHB(plan.tranches[2].amount)} @ ${fmtTHB(plan.tranches[2].price)}`,
        },
        ...d.journal,
      ],
    }));
    router.push("/journal");
  };

  return (
    <main>
      <PageTitle title="แบ่งไม้อัจฉริยะ" sub="ใส่ทุน เลือกเหรียญ ระบบแบ่ง 3 ไม้ 40/40/20 จากแนวรับ-แนวต้านจริงของกราฟ พร้อมจุดตัดขาดทุนและเป้ากำไร" />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card title="ตั้งค่า" className="h-fit">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs text-dim">เหรียญ</span>
              <div className="mt-1">
                <CoinPicker value={id} onChange={setId} />
              </div>
            </label>
            <div>
              <Field label="เงินทุนทั้งหมด" value={capital} onChange={setCapital} suffix="บาท" step={1000} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setCapital(p)}
                    className={`num rounded-md border px-2 py-1 text-xs ${capital === p ? "border-accent text-fg" : "border-line text-muted hover:text-fg"}`}
                  >
                    {p.toLocaleString("th-TH")}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ค่าธรรมเนียม" value={fee} onChange={setFee} suffix="%" step={0.05} />
              <Field label="ยอมขาดทุนสูงสุด" value={maxRisk} onChange={setMaxRisk} suffix="%" step={0.5} />
            </div>
            <p className="text-[11px] leading-relaxed text-dim">ค่าธรรมเนียมกระดานไทยส่วนใหญ่ 0.2–0.25% · DEX มีค่าแก๊ส + ราคาไหลเพิ่ม · นักเทรดมืออาชีพยอมเสียไม่เกิน 2–5% ของทุนต่อแผน</p>

            {a && (
              <div className="border-t border-line pt-4 text-[13px]">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-dim">สัญญาณตอนนี้</span>
                  <ToneBadge tone={a.verdict.tone} />
                </div>
                <p className="leading-relaxed">{a.verdict.headline}</p>
                <Link href={`/coin/${encodeURIComponent(coin.data!.id)}`} className="mt-1 inline-block text-xs text-muted hover:text-fg">
                  คะแนน {a.score}/100 · ดูบทวิเคราะห์เต็ม →
                </Link>
              </div>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          {coin.error && <ErrorBox msg={coin.error} onRetry={coin.reload} />}
          {coin.data?.notice && <Notice>{coin.data.notice}</Notice>}
          {coin.data?.dex && coin.data.dex.safety.score < 40 && (
            <Notice tone="bad">เหรียญ DEX นี้ได้คะแนนความปลอดภัยแค่ {coin.data.dex.safety.score}/100 — ไม่แนะนำให้วางเงินก้อนใหญ่</Notice>
          )}
          {!plan && !coin.error && !coin.data?.notice && <Skeleton className="h-[520px]" />}

          {plan && a && (
            <>
              {plan.recommendedCapital < plan.capital * 0.97 && (
                <Notice>
                  <div className="font-medium">แผนนี้เสี่ยงเกินเพดานที่ตั้งไว้</div>
                  <p className="mt-1 text-fg/80">
                    ลงเต็ม {fmtTHB(plan.capital)} แล้วโดน SL จะเสีย <b className="num">{fmtTHB(-plan.worstLoss)}</b> ({fmtPct(plan.worstLossPct, 1)} ของทุน) — ถ้าอยากเสียไม่เกิน {plan.maxRiskPct}% ควรใช้แค่{" "}
                    <b className="num">{fmtTHB(plan.recommendedCapital)}</b>
                  </p>
                  <button onClick={() => setCapital(Math.floor(plan.recommendedCapital / 100) * 100)} className="mt-2 text-xs underline">
                    ปรับทุนให้อัตโนมัติ
                  </button>
                </Notice>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {plan.tranches.map((t, i) => (
                  <div key={t.key} className={`rounded-2xl border bg-panel p-4 ${i === 0 ? "border-accent/50" : "border-line"}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={i === 0 ? "text-accent" : "text-muted"}>{t.label}</span>
                      <span className="num text-dim">{t.weight * 100}%</span>
                    </div>
                    <div className="num mt-3 text-2xl font-semibold">{fmtTHB(t.amount)}</div>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-dim">ราคาซื้อ</span><span className="num">{fmtTHB(t.price)}</span></div>
                      <div className="flex justify-between"><span className="text-dim">ห่างตอนนี้</span><span className="num">{t.key === "core" ? "ทันที" : fmtPct(t.distancePct, 1)}</span></div>
                      <div className="flex justify-between"><span className="text-dim">ได้เหรียญ</span><span className="num">{fmtQty(t.qty)}</span></div>
                      <div className="flex justify-between"><span className="text-dim">คำสั่ง</span><span>{t.orderType}</span></div>
                    </div>
                    <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-dim">{t.desc}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-panel md:grid-cols-4 md:divide-x">
                {[
                  { k: "Stop Loss", v: plan.stopLoss, p: plan.stopLossPct, c: "text-down", n: "ใต้ไม้ 2 หนึ่ง ATR" },
                  { k: "SL หลังไม้ 3 เข้า", v: plan.trailStop, p: (plan.trailStop / a.price - 1) * 100, c: "text-fg", n: "เลื่อนมาใต้แนวต้านเดิม" },
                  { k: "Take Profit 1", v: plan.tp1, p: plan.tp1Pct, c: "text-up", n: "แนวต้านถัดไป" },
                  { k: "Take Profit 2", v: plan.tp2, p: plan.tp2Pct, c: "text-up", n: "เป้าขยาย Fib 1.618" },
                ].map((x) => (
                  <div key={x.k} className="p-4">
                    <div className="text-xs text-dim">{x.k}</div>
                    <div className={`num mt-1 text-lg font-semibold ${x.c}`}>{fmtTHB(x.v)}</div>
                    <div className="num text-xs text-muted">{fmtPct(x.p, 1)}</div>
                    <div className="mt-1 text-[11px] text-dim">{x.n}</div>
                  </div>
                ))}
              </div>

              <Card
                title="ถ้าเกิดแต่ละสถานการณ์ (หักค่าธรรมเนียมแล้ว)"
              >
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] text-dim">
                        <th className="px-5 pb-2 font-normal">สถานการณ์</th>
                        <th className="px-2 pb-2 text-right font-normal">ลงเงิน</th>
                        <th className="px-2 pb-2 text-right font-normal">ทุนเฉลี่ย</th>
                        <th className="px-2 pb-2 text-right font-normal">โดน SL</th>
                        <th className="px-2 pb-2 text-right font-normal">ถึง TP1</th>
                        <th className="px-2 pb-2 text-right font-normal">ถึง TP2</th>
                        <th className="px-5 pb-2 text-right font-normal">เสี่ยง:ได้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.scenarios.map((s) => (
                        <tr key={s.label} className="border-b border-line/60">
                          <td className="px-5 py-2.5 text-[13px]">{s.label}</td>
                          <td className="num px-2 text-right">{fmtTHB(s.invested)}</td>
                          <td className="num px-2 text-right text-muted">{fmtTHB(s.avgCost)}</td>
                          <td className={`num px-2 text-right ${s.lossAtSL < 0 ? "text-down" : "text-up"}`}>
                            {fmtTHB(s.lossAtSL, { sign: true })}
                            <div className="text-[10px] text-dim">{fmtPct(s.lossPctOfCapital, 1)} ของทุน</div>
                          </td>
                          <td className="num px-2 text-right text-up">{fmtTHB(s.profitTP1, { sign: true })}</td>
                          <td className="num px-2 text-right text-up">{fmtTHB(s.profitTP2, { sign: true })}</td>
                          <td className="num px-5 text-right">{Number.isFinite(s.rrr) ? `1:${s.rrr.toFixed(1)}` : "ไม่ขาดทุน"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-dim">ไม้ 2 ถ้าราคาไม่ลงมาถึงก็ไม่ต้องซื้อ · ไม้ 3 รอแท่งวันปิดเหนือแนวต้านก่อน · เงินที่ยังไม่ใช้ = กระสุนสำรอง</p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <button onClick={saveToJournal} className={btn.primary}>
                    บันทึกไม้ 1 ลงสมุดเทรด
                  </button>
                  <button onClick={copy} className={btn.ghost}>
                    {copied ? "คัดลอกแล้ว ✓" : "คัดลอกแผนไปวาง LINE"}
                  </button>
                </div>
              </Card>

              {coin.data && coin.data.candles.length > 0 && (
                <Card title={`แผนบนกราฟ ${symbol}`}>
                  <CandleChart
                    candles={coin.data.candles}
                    range={150}
                    height={360}
                    levels={[
                      { price: plan.tp2, label: `TP2 ${fmtTHB(plan.tp2)}`, color: "#34d399" },
                      { price: plan.tp1, label: `TP1 ${fmtTHB(plan.tp1)}`, color: "#34d399" },
                      { price: plan.tranches[2].price, label: `ไม้3 ${fmtTHB(plan.tranches[2].price)}`, color: "#a3a9d6", dashed: true },
                      { price: plan.tranches[0].price, label: `ไม้1 ${fmtTHB(plan.tranches[0].price)}`, color: "#eef0ff", dashed: true },
                      { price: plan.tranches[1].price, label: `ไม้2 ${fmtTHB(plan.tranches[1].price)}`, color: "#a3a9d6", dashed: true },
                      { price: plan.stopLoss, label: `SL ${fmtTHB(plan.stopLoss)}`, color: "#fb7185" },
                    ]}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      <Disclaimer />
    </main>
  );
}
