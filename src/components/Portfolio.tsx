"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMarkets } from "@/hooks/data";
import { updateData, useUser } from "@/hooks/user";
import { fmtQty, fmtTHB } from "@/lib/format";
import CoinPicker from "./CoinPicker";
import { Card, Pct, btn } from "./ui";

const SHADES = ["#eef0ff", "#8b7cff", "#a3a9d6", "#6c73a8", "#c4b5fd", "#c7cbee", "#4c3fa8"];

/** พอร์ตของฉัน — ล็อกอินแล้วซิงก์ทุกเครื่อง ไม่ล็อกอินเก็บในเบราว์เซอร์ */
export default function Portfolio() {
  const user = useUser();
  const holdings = user.data.portfolio;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ symbol: "BTC", qty: "", avgCost: "" });

  const symbols = useMemo(
    () => [...new Set([...holdings.map((h) => h.symbol), ...(adding ? [form.symbol] : [])])],
    [holdings, adding, form.symbol],
  );
  const prices = useMarkets({ symbols, limit: 200 });
  const priceOf = (s: string) => prices.data?.coins.find((c) => c.symbol === s);

  const rows = holdings.map((h) => {
    const m = priceOf(h.symbol);
    const value = m ? m.price * h.qty : 0;
    const cost = h.avgCost * h.qty;
    return { ...h, value, cost, pnl: value - cost, pnlPct: cost ? (value / cost - 1) * 100 : 0 };
  });
  const total = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const pnl = total - totalCost;

  const submit = () => {
    const qty = +form.qty;
    const avgCost = +form.avgCost || priceOf(form.symbol)?.price || 0;
    if (!(qty > 0) || !(avgCost > 0)) return;
    updateData((d) => {
      const ex = d.portfolio.find((h) => h.symbol === form.symbol);
      const portfolio = ex
        ? d.portfolio.map((h) => (h.symbol === form.symbol ? { ...h, qty: h.qty + qty, avgCost: (h.avgCost * h.qty + avgCost * qty) / (h.qty + qty) } : h))
        : [...d.portfolio, { symbol: form.symbol, qty, avgCost }];
      return { ...d, portfolio };
    });
    setForm({ ...form, qty: "", avgCost: "" });
    setAdding(false);
  };

  const input = "num w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-dim focus:border-line-2";

  return (
    <Card
      title="พอร์ตของฉัน"
      extra={
        <button onClick={() => setAdding((v) => !v)} className="text-xs text-muted hover:text-fg">
          {adding ? "ปิด" : "+ เพิ่ม"}
        </button>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] text-dim">มูลค่ารวม</div>
          <div className="num text-2xl font-semibold">{fmtTHB(total)}</div>
        </div>
        {totalCost > 0 && (
          <div className="text-right">
            <div className={`num text-sm ${pnl >= 0 ? "text-up" : "text-down"}`}>{fmtTHB(pnl, { sign: true })}</div>
            <Pct v={(total / totalCost - 1) * 100} className="text-xs" />
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3 flex h-1.5 gap-px overflow-hidden rounded-full">
          {rows.map((r, i) => (
            <div key={r.symbol} style={{ width: `${(r.value / total) * 100}%`, background: SHADES[i % SHADES.length] }} title={r.symbol} />
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-4 space-y-2 rounded-xl border border-line p-3">
          <CoinPicker value={form.symbol} onChange={(symbol) => !symbol.startsWith("dex:") && setForm({ ...form, symbol })} />
          <div className="grid grid-cols-2 gap-2">
            <input inputMode="decimal" placeholder="จำนวนเหรียญ" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={input} />
            <input inputMode="decimal" placeholder="ทุน/เหรียญ (บาท)" value={form.avgCost} onChange={(e) => setForm({ ...form, avgCost: e.target.value })} className={input} />
          </div>
          <button onClick={submit} className={`${btn.primary} w-full`}>
            บันทึก
          </button>
          <p className="text-[11px] text-dim">ไม่ใส่ทุน = ใช้ราคาปัจจุบัน · รองรับเหรียญบนกระดาน (เหรียญ DEX ใช้สมุดเทรดแทน)</p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 && !adding && <li className="py-6 text-center text-sm text-dim">ยังไม่มีเหรียญในพอร์ต</li>}
        {rows.map((r, i) => (
          <li key={r.symbol} className="flex items-center gap-3 py-2.5">
            <span className="size-1.5 rounded-full" style={{ background: SHADES[i % SHADES.length] }} />
            <Link href={`/coin/${r.symbol}`} className="min-w-0 flex-1">
              <div className="text-sm font-medium">{r.symbol}</div>
              <div className="num text-[11px] text-dim">
                {fmtQty(r.qty)} · ทุน {fmtTHB(r.avgCost)}
              </div>
            </Link>
            <div className="text-right">
              <div className="num text-sm">{fmtTHB(r.value)}</div>
              <div className={`num text-[11px] ${r.pnl >= 0 ? "text-up" : "text-down"}`}>
                {fmtTHB(r.pnl, { sign: true })} ({r.pnlPct.toFixed(1)}%)
              </div>
            </div>
            <button
              onClick={() => updateData((d) => ({ ...d, portfolio: d.portfolio.filter((h) => h.symbol !== r.symbol) }))}
              className="text-dim hover:text-accent"
              aria-label={`ลบ ${r.symbol}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-dim">
        {user.username ? (
          `ซิงก์กับบัญชี ${user.username}${user.syncing ? " …" : ""}`
        ) : (
          <Link href="/account" className="hover:text-fg">
            เข้าสู่ระบบเพื่อใช้พอร์ตนี้ได้ทุกเครื่อง →
          </Link>
        )}
      </p>
    </Card>
  );
}
