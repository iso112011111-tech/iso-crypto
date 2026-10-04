"use client";

import { useState } from "react";
import { useJSON } from "@/hooks/data";
import { Card, Disclaimer, ErrorBox, PageTitle, Segmented, Skeleton } from "@/components/ui";
import type { Bucket } from "@/lib/validate";

type Result = { buckets: Bucket[]; baseline: Bucket; coins: string[]; samples: number; horizon: number; testedAt: number };

const pct = (v: number | null, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const ret = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

export default function Accuracy() {
  const [top, setTop] = useState(20);
  const [horizon, setHorizon] = useState(30);
  const r = useJSON<Result>(`/api/validate?top=${top}&horizon=${horizon}`);
  const d = r.data;
  const maxWin = d ? Math.max(...d.buckets.map((b) => b.winRate ?? 0), d.baseline.winRate ?? 0) : 1;

  return (
    <main>
      <PageTitle
        title="ระบบให้คะแนนแม่นแค่ไหน"
        sub="ย้อนเวลากลับไปทุก 3 วัน คำนวณคะแนนด้วยข้อมูลเท่าที่มี ณ วันนั้น (ไม่แอบดูอนาคต) แล้วดูว่าในช่วงถัดไป ราคาแตะเป้ากำไรก่อนหรือจุดตัดขาดทุนก่อน"
        right={
          <div className="flex flex-wrap gap-2">
            <Segmented value={top} onChange={setTop} options={[{ value: 20, label: "Top 20" }, { value: 40, label: "Top 40" }]} />
            <Segmented value={horizon} onChange={setHorizon} options={[{ value: 14, label: "ถือ 14 วัน" }, { value: 30, label: "ถือ 30 วัน" }]} />
          </div>
        }
      />

      {r.error && <ErrorBox msg={r.error} onRetry={r.reload} />}
      {!d && !r.error && (
        <div className="space-y-3">
          <p className="text-sm text-muted">กำลังทดสอบย้อนหลังหลายพันจุด… ครั้งแรกใช้เวลาประมาณ 5–30 วินาที</p>
          <Skeleton className="h-80" />
        </div>
      )}

      {d && (
        <>
          <Card title="อัตราชนะตามช่วงคะแนน (แตะเป้ากำไรก่อนจุดตัดขาดทุน)">
            <div className="space-y-4">
              {[...d.buckets, d.baseline].map((b, i) => (
                <div key={b.label} className={i === d.buckets.length ? "border-t border-line pt-4" : ""}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className={i === d.buckets.length ? "text-muted" : ""}>{b.label}</span>
                    <span className="num">
                      {pct(b.winRate)} <span className="text-xs text-dim">· {b.n.toLocaleString("th-TH")} ครั้ง</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((b.winRate ?? 0) / maxWin) * 100}%`,
                        background: i === d.buckets.length ? "#6c73a8" : (b.winRate ?? 0) > (d.baseline.winRate ?? 0) ? "#eef0ff" : "#8b7cff",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="รายละเอียด" className="mt-4">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-dim">
                    <th className="px-5 pb-2 font-normal">ช่วงคะแนน</th>
                    <th className="px-2 pb-2 text-right font-normal">จำนวน</th>
                    <th className="px-2 pb-2 text-right font-normal">อัตราชนะ</th>
                    <th className="px-2 pb-2 text-right font-normal">ถือครบแล้วกำไร</th>
                    <th className="px-2 pb-2 text-right font-normal">ผลตอบแทนเฉลี่ย</th>
                    <th className="px-2 pb-2 text-right font-normal">ค่ากลาง</th>
                    <th className="px-5 pb-2 text-right font-normal">ได้เฉลี่ยต่อ 1R</th>
                  </tr>
                </thead>
                <tbody>
                  {[...d.buckets, d.baseline].map((b) => (
                    <tr key={b.label} className="border-b border-line/60">
                      <td className="px-5 py-2.5">{b.label}</td>
                      <td className="num px-2 text-right text-muted">{b.n.toLocaleString("th-TH")}</td>
                      <td className="num px-2 text-right">{pct(b.winRate, 1)}</td>
                      <td className="num px-2 text-right">{pct(b.positive, 1)}</td>
                      <td className={`num px-2 text-right ${(b.avgRet ?? 0) >= 0 ? "text-up" : "text-down"}`}>{ret(b.avgRet)}</td>
                      <td className={`num px-2 text-right ${(b.medianRet ?? 0) >= 0 ? "text-up" : "text-down"}`}>{ret(b.medianRet)}</td>
                      <td className={`num px-5 text-right ${(b.expectancy ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                        {b.expectancy == null ? "—" : `${b.expectancy >= 0 ? "+" : ""}${b.expectancy.toFixed(2)}R`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-dim">
              ทดสอบ {d.samples.toLocaleString("th-TH")} จุด จาก {d.coins.length} เหรียญ ({d.coins.join(", ")}) · ทดสอบเมื่อ {new Date(d.testedAt).toLocaleString("th-TH")}
            </p>
          </Card>

          <Card title="อ่านผลยังไง" className="mt-4">
            <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
              <li><b className="text-fg">อัตราชนะ</b> — ถ้าซื้อตามแผนของระบบ ราคาแตะเป้ากำไรก่อนจุดตัดขาดทุนกี่ % (ไม่นับครั้งที่ยังไม่แตะทั้งคู่)</li>
              <li><b className="text-fg">ได้เฉลี่ยต่อ 1R</b> — ถ้าเสี่ยงครั้งละ 1 ส่วน จะได้คืนเฉลี่ยกี่ส่วน ค่าบวก = ระบบมีความได้เปรียบ</li>
              <li><b className="text-fg">ทุกจังหวะ (สุ่มเข้า)</b> — ค่าอ้างอิง ถ้าช่วงคะแนนสูงไม่ดีกว่าแถวนี้ แปลว่าคะแนนไม่ช่วยอะไร</li>
              <li>ผลในอดีตไม่รับประกันอนาคต โดยเฉพาะเมื่อสภาพตลาดเปลี่ยน (ขาขึ้น ↔ ขาลง) — ใช้คะแนนเป็นตัวช่วยคัดกรอง ไม่ใช่คำสั่งซื้อ</li>
            </ul>
          </Card>
        </>
      )}
      <Disclaimer />
    </main>
  );
}
