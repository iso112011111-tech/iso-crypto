"use client";

import Link from "next/link";
import { useState } from "react";
import { parseVerdict, useAiStream, VERDICT_CLS } from "@/hooks/ai";
import { useUser } from "@/hooks/user";
import Markdown from "./Markdown";
import { Card, Segmented, btn } from "./ui";

/** ปุ่ม + ผลวิเคราะห์เชิงลึกจาก iso AI บนหน้าเหรียญ */
export default function AiAnalysis({ id, symbol }: { id: string; symbol: string }) {
  const ai = useAiStream();
  const user = useUser();
  const [model, setModel] = useState<"deep" | "fast">("deep");
  const v = parseVerdict(ai.text);
  const started = ai.loading || ai.text || ai.error;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded bg-accent text-[10px] font-bold text-white">AI</span>
          <span className="text-fg">iso AI วิเคราะห์ {symbol}</span>
        </span>
      }
      extra={
        <Segmented
          value={model}
          onChange={setModel}
          options={[
            { value: "deep", label: "ลึก" },
            { value: "fast", label: "เร็ว" },
          ]}
        />
      }
    >
      {!started && (
        <div className="flex flex-wrap items-center gap-4">
          {user.user ? (
            <button onClick={() => ai.run("/api/ai/coin", { id, model })} className={btn.primary}>
              ให้ AI วิเคราะห์เชิงลึก
            </button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(`/coin/${id}`)}`} className={btn.primary}>
              เข้าสู่ระบบเพื่อใช้ AI
            </Link>
          )}
          <p className="max-w-xl text-[13px] leading-relaxed text-muted">
            AI จะอ่านทุกตัวเลขในหน้านี้ + ภาวะตลาด + ผลทดสอบย้อนหลังของระบบ แล้วสรุปเป็นแผนเทรด พร้อมบอกว่าอะไรจะทำให้มุมมองผิด · ใช้เวลา ~20–40 วินาที (โหมดลึก)
          </p>
        </div>
      )}

      {ai.error && <p className="text-sm text-down">{ai.error}</p>}

      {(ai.text || ai.loading) && (
        <>
          {v && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg p-3">
              <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${VERDICT_CLS[v.verdict] ?? ""}`}>{v.verdict}</span>
              <span className="text-sm text-muted">
                โอกาสแตะเป้าก่อน SL ตามที่ AI ประเมิน <b className="num text-fg">{v.confidence}%</b>
              </span>
            </div>
          )}
          <Markdown text={ai.text} />
          {ai.loading && !ai.text && <div className="scanline h-24 rounded-xl bg-panel-2/40" />}
          {ai.loading && (
            <p className="mt-3 flex items-center gap-2 text-xs text-dim">
              <span className="live-dot size-1.5 rounded-full bg-accent" />
              {ai.text ? "กำลังเขียน…" : "กำลังรวบรวมข้อมูลและคิด…"}
              <button onClick={ai.stop} className="ml-2 underline">
                หยุด
              </button>
            </p>
          )}
          {!ai.loading && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-xs text-dim">
              <button onClick={() => ai.run("/api/ai/coin", { id, model })} className={btn.ghost}>
                วิเคราะห์ใหม่
              </button>
              <Link href={`/ai?q=${encodeURIComponent(`ถามต่อเรื่อง ${symbol}: `)}`} className="hover:text-fg">
                ถามต่อในแชต →
              </Link>
              <span className="ml-auto">AI สรุปจากข้อมูลของระบบ ไม่ได้รู้อนาคต · คำตัดสินถูกบันทึกไว้ตรวจผลย้อนหลังที่หน้า ผู้ช่วย AI</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
