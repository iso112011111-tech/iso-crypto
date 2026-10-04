"use client";

import Link from "next/link";
import { useState } from "react";
import { useJSON } from "@/hooks/data";
import { Card, CoinIcon, Disclaimer, ErrorBox, PageTitle, Pct, Segmented, Skeleton, Stat } from "@/components/ui";
import { fmtCompactTHB, fmtPct, fmtTHB } from "@/lib/format";
import type { FuturesRadar, FuturesRow, Listing, PremiumRow } from "@/lib/radar";

type Tab = "futures" | "listings" | "premium";

const usd = (v: number) => `$${v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.round(v).toLocaleString("en-US")}`;
const ago = (t: number, now: number) => {
  const h = (now - t) / 3_600_000;
  return h < 1 ? "ไม่ถึงชั่วโมง" : h < 24 ? `${Math.floor(h)} ชม.ที่แล้ว` : `${Math.floor(h / 24)} วันที่แล้ว`;
};

function FuturesTable({ title, hint, rows, highlight }: { title: string; hint: string; rows: FuturesRow[]; highlight: "funding" | "oi" }) {
  return (
    <Card title={title} extra={<span className="text-[11px] text-dim">{hint}</span>}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-dim">ตอนนี้ไม่มีเหรียญเข้าเงื่อนไข</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.symbol}>
              <Link href={`/coin/${r.symbol}`} className="flex items-center gap-3 py-2.5 transition hover:bg-white/[0.03]">
                <CoinIcon src={r.image} symbol={r.symbol} size={22} />
                <div className="w-20 min-w-0">
                  <div className="text-sm font-medium">{r.symbol}</div>
                  <div className="truncate text-[10px] text-dim">{r.tag}</div>
                </div>
                <div className="ml-auto text-right">
                  {highlight === "funding" ? (
                    <div className={`num text-sm ${r.fundingPct > 0.03 ? "text-down" : r.fundingPct < -0.01 ? "text-up" : ""}`}>
                      {r.fundingPct >= 0 ? "+" : ""}
                      {r.fundingPct.toFixed(4)}%
                    </div>
                  ) : (
                    <div className={`num text-sm ${(r.oiChange24h ?? 0) >= 0 ? "text-up" : "text-down"}`}>OI {fmtPct(r.oiChange24h ?? 0, 1)}</div>
                  )}
                  <div className="num text-[11px] text-dim">
                    ราคา <Pct v={r.change24h} className="text-[11px]" /> · OI {usd(r.oiUsd)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Futures() {
  const r = useJSON<FuturesRadar>("/api/radar?tab=futures", 120_000);
  const d = r.data;
  if (r.error) return <ErrorBox msg={r.error} onRetry={r.reload} />;
  if (!d) return <Skeleton className="h-96" />;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Funding เฉลี่ยทั้งตลาด"
          value={<span className={`num ${d.marketFundingAvg > 0.02 ? "text-down" : d.marketFundingAvg < 0 ? "text-up" : ""}`}>{d.marketFundingAvg.toFixed(4)}%</span>}
          sub={d.marketFundingAvg > 0.02 ? "ตลาดเลเวอเรจฝั่ง Long หนา ระวังโดนล้าง" : d.marketFundingAvg < 0 ? "ตลาดเอียงฝั่ง Short — มักเป็นช่วงใกล้ดีด" : "ปกติ ไม่ร้อนไม่เย็น"}
        />
        <Stat label="เหรียญที่สแกน" value={<span className="num">{d.scanned}</span>} sub="สัญญาฟิวเจอร์สที่มีสภาพคล่องจริง" />
        <Stat label="ผู้ต้องสงสัย Squeeze" value={<span className="num text-up">{d.squeeze.length}</span>} sub="Short แน่น + OI เพิ่ม + ราคาเริ่มขึ้น" />
        <Stat label="อัปเดต" value={<span className="num text-base">{new Date(d.updatedAt).toLocaleTimeString("th-TH")}</span>} sub="ข้อมูลจาก Binance + Bybit ทุก 5 นาที" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FuturesTable title="🔥 ผู้ต้องสงสัย Short Squeeze" hint="ราคาอาจดีดแรงถ้า Short ถูกบังคับปิด" rows={d.squeeze} highlight="funding" />
        <FuturesTable title="📈 OI เปลี่ยนแรงใน 24 ชม." hint="เงินเลเวอเรจไหลเข้า/ออก" rows={d.oiSurge} highlight="oi" />
        <FuturesTable title="Funding ร้อนสุด" hint="Long จ่ายแพง เสี่ยงโดนทุบล้าง" rows={d.hotFunding} highlight="funding" />
        <FuturesTable title="Funding ติดลบสุด" hint="คนเล่นขาลงเยอะ" rows={d.negativeFunding} highlight="funding" />
      </div>
    </>
  );
}

function Listings() {
  const r = useJSON<{ rows: Listing[]; trackingSince: number | null; updatedAt: number }>("/api/radar?tab=listings", 300_000);
  const [onlyThai, setOnlyThai] = useState(false);
  if (r.error) return <ErrorBox msg={r.error} onRetry={r.reload} />;
  if (!r.data) return <Skeleton className="h-96" />;
  const rows = r.data.rows.filter((x) => !onlyThai || x.market?.onThai);
  return (
    <Card
      title="เหรียญเข้ากระดานใหม่ (45 วันล่าสุด)"
      extra={
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyThai} onChange={(e) => setOnlyThai(e.target.checked)} className="accent-[#8b7cff]" />
          เฉพาะที่ซื้อได้ในไทย
        </label>
      }
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-dim">
              <th className="px-5 pb-2 font-normal">เหรียญ</th>
              <th className="px-2 pb-2 font-normal">กระดาน</th>
              <th className="px-2 pb-2 font-normal">เข้าเมื่อ</th>
              <th className="px-2 pb-2 text-right font-normal">ราคา</th>
              <th className="px-2 pb-2 text-right font-normal">24 ชม.</th>
              <th className="px-5 pb-2 text-right font-normal">วอลุ่มรวม</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-dim">
                  ไม่มีเหรียญใหม่ในช่วงนี้
                </td>
              </tr>
            )}
            {rows.map((x) => (
              <tr key={`${x.symbol}-${x.ex}`} className="border-b border-line/60 transition hover:bg-white/[0.03]">
                <td className="px-5 py-2.5">
                  <Link href={`/coin/${x.symbol}`} className="flex items-center gap-2.5">
                    <CoinIcon src={x.market?.image} symbol={x.symbol} size={22} />
                    <div>
                      <div className="font-medium">
                        {x.symbol} {x.market?.onThai && <span className="ml-1 rounded border border-up/40 px-1 text-[9px] text-up">TH</span>}
                      </div>
                      <div className="text-[11px] text-dim">{x.market?.th ?? (x.market?.name !== x.symbol ? x.market?.name : "")}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-2 text-muted">
                  {x.exName}
                  {x.source === "detected" && <span className="ml-1 text-[10px] text-dim">(ระบบจับได้)</span>}
                </td>
                <td className="whitespace-nowrap px-2 text-muted">{ago(x.listedAt, r.data!.updatedAt)}</td>
                <td className="num whitespace-nowrap px-2 text-right">{x.market ? fmtTHB(x.market.price) : "—"}</td>
                <td className="whitespace-nowrap px-2 text-right">{x.market && <Pct v={x.market.change24h} className="text-xs" />}</td>
                <td className="num whitespace-nowrap px-5 text-right text-muted">{x.market ? fmtCompactTHB(x.market.quoteVolume) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-dim">
        OKX และ Gate ใช้วันลิสต์จริงจากกระดาน · Binance, Bitkub, Binance TH และกระดานอื่นระบบจับจากการเห็นครั้งแรก
        {r.data.trackingSince && ` (เริ่มจับตั้งแต่ ${new Date(r.data.trackingSince).toLocaleDateString("th-TH")})`} · เหรียญใหม่ผันผวนรุนแรง ส่วนใหญ่ร่วงหลังลิสต์ — ใช้ไม้เล็กและตั้ง SL เสมอ
      </p>
    </Card>
  );
}

function Premium() {
  const r = useJSON<{ rows: PremiumRow[]; avgBitkub: number | null }>("/api/radar?tab=premium", 30_000);
  if (r.error) return <ErrorBox msg={r.error} onRetry={r.reload} />;
  if (!r.data) return <Skeleton className="h-96" />;
  const d = r.data;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat
          label="Bitkub แพงกว่าตลาดโลกเฉลี่ย"
          value={<span className="num">{d.avgBitkub != null ? fmtPct(d.avgBitkub) : "—"}</span>}
          sub={d.avgBitkub != null && d.avgBitkub > 1 ? "คนไทยไล่ซื้อแรง ตลาดอาจร้อน" : d.avgBitkub != null && d.avgBitkub < -0.5 ? "คนไทยเทขาย มักเป็นช่วงกลัว" : "ปกติ (ส่วนต่างจากค่าแลกเงิน/ค่าโอน)"}
        />
        <Stat label="เหรียญที่เปรียบเทียบ" value={<span className="num">{d.rows.length}</span>} sub="เฉพาะที่มีวอลุ่มในไทยจริง" />
      </div>
      <Card title="ส่วนต่างราคาไทย vs ตลาดโลก (เรียงจากต่างมากสุด)">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-dim">
                <th className="px-5 pb-2 font-normal">เหรียญ</th>
                <th className="px-2 pb-2 font-normal">กระดานไทย</th>
                <th className="px-2 pb-2 text-right font-normal">ราคาไทย</th>
                <th className="px-2 pb-2 text-right font-normal">ราคาโลก</th>
                <th className="px-2 pb-2 text-right font-normal">ส่วนต่าง</th>
                <th className="px-2 pb-2 text-right font-normal">หลังค่าธรรมเนียม</th>
                <th className="px-5 pb-2 text-right font-normal">วอลุ่มไทย</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.slice(0, 40).map((x) => (
                <tr key={`${x.symbol}-${x.ex}`} className="border-b border-line/60 transition hover:bg-white/[0.03]">
                  <td className="px-5 py-2.5">
                    <Link href={`/coin/${x.symbol}`} className="flex items-center gap-2.5">
                      <CoinIcon src={x.image} symbol={x.symbol} size={22} />
                      <span className="font-medium">{x.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-2 text-muted">{x.exName}</td>
                  <td className="num whitespace-nowrap px-2 text-right">{fmtTHB(x.thaiPrice)}</td>
                  <td className="num whitespace-nowrap px-2 text-right text-muted">{fmtTHB(x.globalPrice)}</td>
                  <td className={`num whitespace-nowrap px-2 text-right ${Math.abs(x.premiumPct) > 1.5 ? (x.premiumPct > 0 ? "text-down" : "text-up") : ""}`}>{fmtPct(x.premiumPct)}</td>
                  <td className="num whitespace-nowrap px-2 text-right text-muted">{x.netPct === 0 ? "ไม่คุ้ม" : fmtPct(x.netPct)}</td>
                  <td className="num whitespace-nowrap px-5 text-right text-muted">{fmtCompactTHB(x.thaiVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">
          แดง = ไทยแพงกว่า (ระวังซื้อแพง) · เขียว = ไทยถูกกว่า · “หลังค่าธรรมเนียม” หักค่าซื้อ+ขายรวม ~0.5% แล้ว แต่ยังไม่รวมค่าถอน/ค่าโอนข้ามกระดานและเวลาที่เงินค้างระหว่างโอน — ส่วนต่างอาจหายก่อนโอนถึง
        </p>
      </Card>
    </>
  );
}

export default function Radar() {
  const [tab, setTab] = useState<Tab>("futures");
  return (
    <main>
      <PageTitle
        title={
          <>
            เรดาร์<span className="text-gradient">หาโอกาส</span>
          </>
        }
        sub="จับสัญญาณที่คนส่วนใหญ่ยังไม่เห็น: เลเวอเรจล้นตลาด เหรียญเข้ากระดานใหม่ และราคาไทยที่เพี้ยนจากตลาดโลก"
        right={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "futures", label: "ฟิวเจอร์ส" },
              { value: "listings", label: "เหรียญใหม่" },
              { value: "premium", label: "ไทย vs โลก" },
            ]}
          />
        }
      />
      {tab === "futures" && <Futures />}
      {tab === "listings" && <Listings />}
      {tab === "premium" && <Premium />}
      <Disclaimer />
    </main>
  );
}
