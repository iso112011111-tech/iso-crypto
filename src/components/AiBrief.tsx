"use client";

import { useState } from "react";
import { useJSON } from "@/hooks/data";
import Markdown from "./Markdown";
import { Card } from "./ui";

/** สรุปตลาดจาก AI วันละ 2 รอบ (08:00 / 20:00) — ทุกคนเห็นฉบับเดียวกัน */
export default function AiBrief() {
  const r = useJSON<{ text: string; at: number; slot: string; stale?: boolean }>("/api/ai/brief", 15 * 60_000);
  const [open, setOpen] = useState(false);
  if (r.error && !r.data) return null; // ยังไม่ได้ตั้งค่า AI ก็ไม่ต้องแสดง

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded bg-gradient-to-br from-[#6366f1] to-[#a78bfa] text-[10px] font-bold text-white">AI</span>
          <span className="text-fg">สรุปตลาดวันนี้</span>
        </span>
      }
      extra={
        r.data && (
          <span className="text-[11px] text-dim">
            {r.data.slot.endsWith("am") ? "รอบเช้า" : "รอบเย็น"} · {new Date(r.data.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
          </span>
        )
      }
    >
      {!r.data ? (
        <div className="scanline h-28 rounded-xl bg-panel-2/40" />
      ) : (
        <>
          <div className={`relative overflow-hidden transition-[max-height] duration-500 ${open ? "max-h-[2000px]" : "max-h-48"}`}>
            <Markdown text={r.data.text} />
            {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#141a48] to-transparent" />}
          </div>
          <button onClick={() => setOpen((v) => !v)} className="mt-2 text-xs text-accent-2 hover:underline">
            {open ? "ย่อ" : "อ่านทั้งหมด →"}
          </button>
        </>
      )}
    </Card>
  );
}
