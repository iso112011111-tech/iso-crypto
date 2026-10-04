"use client";

import CoinPicker from "@/components/CoinPicker";
import { useMemo, useState } from "react";
import { useCoin } from "@/hooks/data";
import { runBacktest } from "@/lib/backtest";
import { fmtPct, fmtQty, fmtTHB } from "@/lib/format";
import { LineChart } from "@/components/Charts";
import { Card, Disclaimer, ErrorBox, PageTitle, Segmented, Skeleton } from "@/components/ui";

const COLORS = { lump: "#8088c0", dca: "#eef0ff", smart: "#8b7cff" };

export default function Backtest() {
  const [symbol, setSymbol] = useState("BTC"); // หรือ dex:<chain>:<address>
  const [amount, setAmount] = useState(1000);
  const [every, setEvery] = useState(7);
  const [days, setDays] = useState(365);
  const coin = useCoin(symbol);

  const results = useMemo(
    () => (coin.data && amount > 0 ? runBacktest(coin.data.candles, days, amount, every) : null),
    [coin.data, amount, every, days],
  );
  const best = results ? results.reduce((b, r) => (r.roi > b.roi ? r : b)) : null;
  const smart = results?.find((r) => r.key === "smart");
  const dca = results?.find((r) => r.key === "dca");

  return (
    <main>
      <PageTitle
        title="ทดสอบ DCA ย้อนหลัง"
        sub="ถ้าย้อนเวลาไปทยอยซื้อ จะได้ผลเท่าไหร่? เทียบ 3 กลยุทธ์ด้วยราคาจริงย้อนหลัง"
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs text-dim">เหรียญ</span>
            <div className="mt-1"><CoinPicker value={symbol} onChange={setSymbol} /></div>
          </label>
          <label className="block">
            <span className="text-xs text-dim">ซื้อครั้งละ</span>
            <div className="mt-1 flex items-center rounded-lg border border-line bg-bg focus-within:border-line-2">
              <input
                type="number" min={0} step={100} value={Number.isFinite(amount) ? amount : ""}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                className="num w-28 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <span className="pr-3 text-xs text-dim">บาท</span>
            </div>
          </label>
          <div>
            <span className="text-xs text-dim">ความถี่</span>
            <div className="mt-1">
              <Segmented value={every} onChange={setEvery} options={[{ value: 1, label: "ทุกวัน" }, { value: 7, label: "ทุกสัปดาห์" }, { value: 30, label: "ทุกเดือน" }]} />
            </div>
          </div>
          <div>
            <span className="text-xs text-dim">ย้อนหลัง</span>
            <div className="mt-1">
              <Segmented value={days} onChange={setDays} options={[{ value: 90, label: "3 เดือน" }, { value: 180, label: "6 เดือน" }, { value: 365, label: "1 ปี" }]} />
            </div>
          </div>
        </div>
      </Card>

      {coin.error && <div className="mt-4"><ErrorBox msg={coin.error} onRetry={coin.reload} /></div>}

      {!results && !coin.error && <Skeleton className="mt-4 h-[460px]" />}

      {results && best && (
        <>
          {coin.data && coin.data.candles.length < days && (
            <p className="mt-4 rounded-xl border border-warn/30 bg-panel p-3 text-sm text-warn">
              {coin.data.dex?.symbol ?? symbol} มีข้อมูลแค่ {coin.data.candles.length} วัน จึงทดสอบได้เท่าที่มี (ตั้งแต่วันแรกที่เข้ากระดาน)
            </p>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {results.map((r) => (
              <div key={r.key} className={`rounded-2xl border bg-panel p-5 ${r === best ? "border-accent/60" : "border-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: COLORS[r.key] }}>{r.label}</span>
                  {r === best && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-white">ดีที่สุด</span>}
                </div>
                <p className="mt-1 text-[11px] text-dim">{r.desc}</p>
                <div className={`num mt-3 text-3xl font-semibold ${r.roi >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.roi, 1)}</div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-dim">เงินลงทุน</span><span className="num">{fmtTHB(r.invested)}</span></div>
                  <div className="flex justify-between"><span className="text-dim">มูลค่าตอนนี้</span><span className="num">{fmtTHB(r.value)}</span></div>
                  <div className="flex justify-between"><span className="text-dim">กำไร/ขาดทุน</span><span className={`num ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{fmtTHB(r.pnl, { sign: true })}</span></div>
                  <div className="flex justify-between"><span className="text-dim">ต้นทุนเฉลี่ย</span><span className="num">{fmtTHB(r.avgCost)}</span></div>
                  <div className="flex justify-between"><span className="text-dim">ได้เหรียญ</span><span className="num">{fmtQty(r.qty)}</span></div>
                  <div className="flex justify-between"><span className="text-dim">ติดลบหนักสุดระหว่างทาง</span><span className="num text-down">{fmtPct(r.maxDrawdown, 1)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {smart && dca && (
            <p className="mt-3 rounded-xl border border-line bg-panel p-3 text-[13px] leading-relaxed">
              Smart DCA ได้ต้นทุนเฉลี่ย <b className="num">{fmtTHB(smart.avgCost)}</b> เทียบ DCA ปกติ <b className="num">{fmtTHB(dca.avgCost)}</b>{" "}
              {smart.avgCost < dca.avgCost
                ? `— ถูกกว่า ${((1 - smart.avgCost / dca.avgCost) * 100).toFixed(1)}% เพราะซื้อหนักช่วงตลาดกลัว`
                : "— ช่วงนี้ตลาดขึ้นทางเดียว การรอซื้อตอนถูกจึงไม่ได้เปรียบ"}
            </p>
          )}

          <Card title="มูลค่าพอร์ตตามเวลา" className="mt-4">
            <LineChart
              times={results[0].curve.map((p) => p.t)}
              series={[
                ...results.map((r) => ({ label: r.label, color: COLORS[r.key], values: r.curve.map((p) => p.value) })),
                { label: "เงินลงทุน DCA", color: "#6c73a8", values: dca!.curve.map((p) => p.invested), dashed: true },
              ]}
            />
          </Card>
          <p className="mt-3 text-xs text-dim">
            ใช้ราคาปิดรายวันจริงจาก {coin.data?.source ?? "กระดาน"} คิดเป็นบาทด้วยอัตรา USDT/THB ปัจจุบัน · หักค่าธรรมเนียม 0.25% ทั้งซื้อและขาย · ผลในอดีตไม่รับประกันอนาคต
          </p>
        </>
      )}
      <Disclaimer />
    </main>
  );
}
