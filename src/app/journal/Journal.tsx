"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCoin, useMarkets } from "@/hooks/data";
import { updateData, useUser } from "@/hooks/user";
import CoinPicker from "@/components/CoinPicker";
import { Card, Disclaimer, Notice, PageTitle, Stat, btn } from "@/components/ui";
import { fmtPct, fmtQty, fmtTHB } from "@/lib/format";
import type { JournalEntry } from "@/lib/types";

/* ---------- คำนวณผลเทรด ---------- */
export function pnlOf(e: JournalEntry, price: number) {
  const gross = (price - e.entry) * e.qty;
  const fees = (e.feePct / 100) * (e.entry * e.qty + price * e.qty);
  const net = gross - fees;
  const risk = e.sl && e.sl < e.entry ? (e.entry - e.sl) * e.qty : null;
  return { net, pct: (net / (e.entry * e.qty)) * 100, r: risk ? net / risk : null };
}

const dateTH = (t: number) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function stats(closed: JournalEntry[]) {
  const res = closed.map((e) => pnlOf(e, e.exit!));
  const wins = res.filter((r) => r.net > 0);
  const losses = res.filter((r) => r.net <= 0);
  const rs = res.map((r) => r.r).filter((x): x is number => x != null);
  const grossWin = wins.reduce((s, r) => s + r.net, 0);
  const grossLoss = -losses.reduce((s, r) => s + r.net, 0);
  return {
    n: closed.length,
    winRate: closed.length ? wins.length / closed.length : null,
    net: res.reduce((s, r) => s + r.net, 0),
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : null,
  };
}

/* ---------- ฟอร์มเพิ่มเทรด ---------- */
function AddForm({ initialId, onDone }: { initialId: string; onDone: () => void }) {
  const [id, setId] = useState(initialId);
  const coin = useCoin(id);
  const price = coin.data?.dex?.price ?? coin.data?.market?.price ?? coin.data?.analysis?.price;
  const [f, setF] = useState({ entry: "", amount: "", sl: "", tp: "", fee: "0.25", note: "" });
  const symbol = coin.data?.dex?.symbol ?? coin.data?.market?.symbol ?? id;
  const a = coin.data?.analysis;

  const entry = +f.entry || price || 0;
  const amount = +f.amount;
  const qty = entry > 0 && amount > 0 ? (amount * (1 - (+f.fee || 0) / 100)) / entry : 0;

  const save = () => {
    if (!(qty > 0)) return;
    updateData((d) => ({
      ...d,
      journal: [
        {
          id: crypto.randomUUID(),
          assetId: coin.data?.id ?? id,
          symbol,
          entry,
          qty,
          sl: +f.sl || a?.trade.stopLoss || undefined,
          tp: +f.tp || a?.trade.takeProfit || undefined,
          openedAt: Date.now(),
          feePct: +f.fee || 0,
          setupScore: a?.score,
          note: f.note || undefined,
        },
        ...d.journal,
      ],
    }));
    onDone();
  };

  const input = "num w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-dim focus:border-line-2";
  return (
    <Card title="บันทึกการซื้อใหม่">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="text-xs text-dim">เหรียญ</span>
          <div className="mt-1">
            <CoinPicker value={id} onChange={setId} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-dim">ราคาที่ซื้อ (บาท)</span>
          <input className={`${input} mt-1`} inputMode="decimal" placeholder={price ? `ตอนนี้ ${fmtTHB(price)}` : ""} value={f.entry} onChange={(e) => setF({ ...f, entry: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-dim">ใช้เงิน (บาท)</span>
          <input className={`${input} mt-1`} inputMode="decimal" placeholder="เช่น 10000" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-dim">ตัดขาดทุน (SL)</span>
          <input className={`${input} mt-1`} inputMode="decimal" placeholder={a ? `แนะนำ ${fmtTHB(a.trade.stopLoss)}` : "ไม่บังคับ"} value={f.sl} onChange={(e) => setF({ ...f, sl: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-dim">เป้ากำไร (TP)</span>
          <input className={`${input} mt-1`} inputMode="decimal" placeholder={a ? `แนะนำ ${fmtTHB(a.trade.takeProfit)}` : "ไม่บังคับ"} value={f.tp} onChange={(e) => setF({ ...f, tp: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-dim">ค่าธรรมเนียม (%)</span>
          <input className={`${input} mt-1`} inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} />
        </label>
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-xs text-dim">เหตุผลที่เข้า / โน้ต</span>
          <input className={`${input} mt-1 font-sans`} placeholder="เช่น ย่อมาแนวรับ วอลุ่มเข้า" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!(qty > 0)} className={btn.primary}>
          บันทึก
        </button>
        <button onClick={onDone} className={btn.ghost}>
          ยกเลิก
        </button>
        {qty > 0 && (
          <span className="text-xs text-muted">
            ได้ <span className="num">{fmtQty(qty)}</span> {symbol}
            {a && ` · คะแนนตอนเข้า ${a.score}`} · SL/TP ว่างไว้จะใช้ค่าที่ระบบแนะนำ
          </span>
        )}
      </div>
    </Card>
  );
}

/* ---------- แถวเทรดที่ยังถืออยู่ ---------- */
function OpenRow({ e, livePrice }: { e: JournalEntry; livePrice?: number }) {
  // เหรียญ DEX ไม่อยู่ในตารางราคากระดาน ดึงราคาแยกเฉพาะแถวนั้น
  const dex = useCoin(e.assetId.startsWith("dex:") ? e.assetId : null, 60_000);
  const price = livePrice ?? dex.data?.dex?.price;
  const p = price ? pnlOf(e, price) : null;
  const [closing, setClosing] = useState(false);
  const [exit, setExit] = useState("");
  const hitSL = price != null && e.sl != null && price <= e.sl;
  const hitTP = price != null && e.tp != null && price >= e.tp;

  const close = () => {
    const x = +exit || price;
    if (!x) return;
    updateData((d) => ({ ...d, journal: d.journal.map((j) => (j.id === e.id ? { ...j, exit: x, closedAt: Date.now() } : j)) }));
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={`/coin/${encodeURIComponent(e.assetId)}`} className="w-24">
          <div className="font-medium">{e.symbol}</div>
          <div className="text-[11px] text-dim">{dateTH(e.openedAt)}</div>
        </Link>
        <div className="text-xs">
          <div className="text-dim">เข้า</div>
          <div className="num">{fmtTHB(e.entry)}</div>
        </div>
        <div className="text-xs">
          <div className="text-dim">ตอนนี้</div>
          <div className="num">{price ? fmtTHB(price) : "…"}</div>
        </div>
        <div className="text-xs">
          <div className="text-dim">SL / TP</div>
          <div className="num">
            <span className="text-down">{e.sl ? fmtTHB(e.sl) : "—"}</span> / <span className="text-up">{e.tp ? fmtTHB(e.tp) : "—"}</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          {p && (
            <>
              <div className={`num text-sm ${p.net >= 0 ? "text-up" : "text-down"}`}>{fmtTHB(p.net, { sign: true })}</div>
              <div className="num text-[11px] text-dim">
                {fmtPct(p.pct, 1)}
                {p.r != null && ` · ${p.r >= 0 ? "+" : ""}${p.r.toFixed(2)}R`}
              </div>
            </>
          )}
        </div>
        <button onClick={() => setClosing((v) => !v)} className={btn.ghost}>
          ปิดเทรด
        </button>
      </div>
      {(hitSL || hitTP) && <p className={`mt-2 text-xs ${hitSL ? "text-down" : "text-up"}`}>{hitSL ? "ราคาหลุด SL แล้ว — ทำตามแผน ตัดขาดทุน" : "ราคาถึงเป้าแล้ว — พิจารณาขายทำกำไร"}</p>}
      {e.note && <p className="mt-1.5 text-xs text-dim">{e.note}</p>}
      {closing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            inputMode="decimal"
            placeholder={price ? `ราคาขาย (ตอนนี้ ${fmtTHB(price)})` : "ราคาขาย"}
            value={exit}
            onChange={(ev) => setExit(ev.target.value)}
            className="num w-56 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-dim"
          />
          <button onClick={close} className={btn.primary}>
            ยืนยันปิด
          </button>
          <button
            onClick={() => updateData((d) => ({ ...d, journal: d.journal.filter((j) => j.id !== e.id) }))}
            className="text-xs text-dim hover:text-accent"
          >
            ลบรายการนี้
          </button>
        </div>
      )}
    </li>
  );
}

export default function Journal({ addId }: { addId: string | null }) {
  const user = useUser();
  const [adding, setAdding] = useState(!!addId);
  const journal = user.data.journal;
  const open = journal.filter((e) => e.exit == null);
  const closed = journal.filter((e) => e.exit != null).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const cexSymbols = useMemo(() => [...new Set(open.filter((e) => !e.assetId.startsWith("dex:")).map((e) => e.assetId))], [open]);
  const prices = useMarkets({ symbols: cexSymbols, limit: 200 });
  const priceOf = (s: string) => prices.data?.coins.find((c) => c.symbol === s)?.price;

  const st = stats(closed);
  const hiScore = stats(closed.filter((e) => (e.setupScore ?? 0) >= 60));
  const loScore = stats(closed.filter((e) => e.setupScore != null && e.setupScore < 60));
  const unrealized = open.reduce((s, e) => {
    const p = priceOf(e.assetId);
    return p ? s + pnlOf(e, p).net : s;
  }, 0);

  return (
    <main>
      <PageTitle
        title="สมุดเทรด"
        sub="จดทุกการซื้อขาย แล้วให้ตัวเลขบอกว่าคุณเทรดเก่งขึ้นหรือไม่ — วินัยสำคัญกว่าสัญญาณ"
        right={
          !adding && (
            <button onClick={() => setAdding(true)} className={btn.primary}>
              + บันทึกการซื้อ
            </button>
          )
        }
      />

      {!user.username && user.ready && (
        <div className="mb-4">
          <Notice tone="info">
            ตอนนี้สมุดเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ·{" "}
            <Link href="/account" className="text-fg underline">
              สมัคร/เข้าสู่ระบบ
            </Link>{" "}
            เพื่อใช้ได้ทุกเครื่องและไม่หาย
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="เทรดที่ปิดแล้ว" value={<span className="num">{st.n}</span>} />
        <Stat label="อัตราชนะ" value={<span className="num">{st.winRate != null ? `${(st.winRate * 100).toFixed(0)}%` : "—"}</span>} />
        <Stat label="กำไรสุทธิ" value={<span className={`num ${st.net >= 0 ? "text-up" : "text-down"}`}>{fmtTHB(st.net, { sign: true })}</span>} />
        <Stat
          label="R เฉลี่ยต่อเทรด"
          value={<span className="num">{st.avgR != null ? `${st.avgR >= 0 ? "+" : ""}${st.avgR.toFixed(2)}R` : "—"}</span>}
          sub="กำไร ÷ ความเสี่ยงที่ตั้งไว้ (SL)"
        />
        <Stat
          label={`ถือค้าง ${open.length} รายการ`}
          value={<span className={`num ${unrealized >= 0 ? "text-up" : "text-down"}`}>{fmtTHB(unrealized, { sign: true })}</span>}
          sub="กำไร/ขาดทุนที่ยังไม่ขาย"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {adding && (
        <div className="mt-4">
          <AddForm initialId={addId ?? "BTC"} onDone={() => setAdding(false)} />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card title={`กำลังถือ (${open.length})`}>
            {open.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">ไม่มีเทรดที่เปิดอยู่</p>
            ) : (
              <ul className="divide-y divide-line">
                {open.map((e) => (
                  <OpenRow key={e.id} e={e} livePrice={priceOf(e.assetId)} />
                ))}
              </ul>
            )}
          </Card>

          <Card title={`ปิดแล้ว (${closed.length})`}>
            {closed.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">ยังไม่มีเทรดที่ปิด</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-dim">
                      <th className="px-5 pb-2 font-normal">เหรียญ</th>
                      <th className="px-2 pb-2 text-right font-normal">เข้า → ออก</th>
                      <th className="px-2 pb-2 text-right font-normal">คะแนนตอนเข้า</th>
                      <th className="px-2 pb-2 text-right font-normal">ผล</th>
                      <th className="px-5 pb-2 text-right font-normal">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.map((e) => {
                      const p = pnlOf(e, e.exit!);
                      return (
                        <tr key={e.id} className="border-b border-line/60">
                          <td className="px-5 py-2.5">
                            <div className="font-medium">{e.symbol}</div>
                            <div className="text-[11px] text-dim">
                              {dateTH(e.openedAt)} → {dateTH(e.closedAt!)}
                            </div>
                          </td>
                          <td className="num px-2 text-right text-muted">
                            {fmtTHB(e.entry)} → {fmtTHB(e.exit!)}
                          </td>
                          <td className="num px-2 text-right text-muted">{e.setupScore ?? "—"}</td>
                          <td className={`num px-2 text-right ${p.net >= 0 ? "text-up" : "text-down"}`}>
                            {fmtTHB(p.net, { sign: true })}
                            <div className="text-[10px]">{fmtPct(p.pct, 1)}</div>
                          </td>
                          <td className="num px-5 text-right">{p.r != null ? `${p.r >= 0 ? "+" : ""}${p.r.toFixed(2)}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="บทเรียนจากสมุดของคุณ" className="h-fit">
          {st.n < 5 ? (
            <p className="text-sm leading-relaxed text-muted">ปิดเทรดอย่างน้อย 5 รายการ ระบบจะเริ่มสรุปจุดแข็ง-จุดอ่อนให้</p>
          ) : (
            <ul className="space-y-3 text-[13px] leading-relaxed">
              <li>
                Profit factor <b className="num">{st.profitFactor == null ? "—" : Number.isFinite(st.profitFactor) ? st.profitFactor.toFixed(2) : "∞"}</b>{" "}
                <span className="text-muted">{st.profitFactor != null && st.profitFactor >= 1.5 ? "— ระบบของคุณทำเงินได้ดี" : st.profitFactor != null && st.profitFactor >= 1 ? "— พอเลี้ยงตัวได้" : "— ยังขาดทุนรวม"}</span>
              </li>
              {hiScore.n >= 3 && loScore.n >= 3 && (
                <li>
                  เข้าตอนคะแนน ≥60 ชนะ <b className="num">{(hiScore.winRate! * 100).toFixed(0)}%</b> · คะแนน &lt;60 ชนะ{" "}
                  <b className="num">{(loScore.winRate! * 100).toFixed(0)}%</b>
                  <span className="text-muted">{hiScore.winRate! > loScore.winRate! ? " — เลือกเข้าตอนคะแนนสูงช่วยคุณได้จริง" : " — คะแนนยังไม่ช่วยในแบบที่คุณเทรด"}</span>
                </li>
              )}
              {st.avgR != null && st.avgR < 0 && st.winRate != null && st.winRate > 0.5 && (
                <li className="text-warn">ชนะบ่อยแต่ขาดทุนรวม — กำไรน้อยเกิน/ขาดทุนใหญ่เกิน ลองถือกำไรให้ถึงเป้าและตัด SL ให้ไวขึ้น</li>
              )}
              {closed.filter((e) => !e.sl).length > closed.length / 2 && <li className="text-warn">เทรดส่วนใหญ่ไม่ได้ตั้ง SL — ความเสี่ยงอันดับ 1 ของนักเทรดรายย่อย</li>}
            </ul>
          )}
        </Card>
      </div>
      <Disclaimer />
    </main>
  );
}
