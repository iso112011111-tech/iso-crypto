"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAiStream, VERDICT_CLS } from "@/hooks/ai";
import { useJSON } from "@/hooks/data";
import { useUser } from "@/hooks/user";
import Markdown from "@/components/Markdown";
import { Card, Disclaimer, PageTitle, Segmented, btn } from "@/components/ui";
import { fmtPct, fmtTHB } from "@/lib/format";

type Msg = { role: "user" | "assistant"; content: string };
type Call = { id: string; assetId: string; symbol: string; verdict: string; confidence: number; price: number; at: number; ageHours: number; now: number | null; changePct: number | null };

const QUICK = [
  "ตลาดวันนี้ควรทำอะไร รุก รับ หรือถือเงินสด?",
  "คัด 3 เหรียญน่าสะสมที่สุดจากผลสแกน พร้อมแผนเทรด",
  "เหรียญไหนใน Top 50 ที่ควรหลีกเลี่ยงตอนนี้ เพราะอะไร",
  "ช่วยดูพอร์ตของฉัน ควรปรับอะไรบ้าง",
  "เทียบ BTC กับ ETH ตอนนี้ตัวไหนได้เปรียบกว่า",
];

function TrackRecord() {
  const r = useJSON<{ calls: Call[] }>("/api/ai/calls", 60_000);
  const calls = r.data?.calls ?? [];
  // นับเฉพาะคำตัดสินที่ผ่านมาแล้วอย่างน้อย 1 วัน
  const matured = calls.filter((c) => c.ageHours >= 24 && c.changePct != null);
  const bullish = matured.filter((c) => c.verdict === "เข้า" || c.verdict === "ทยอย");
  const right = bullish.filter((c) => (c.changePct ?? 0) > 0).length;

  return (
    <Card title="AI เคยพูดอะไรไว้ — ถูกหรือผิด">
      {calls.length === 0 ? (
        <p className="text-sm leading-relaxed text-dim">ยังไม่มีประวัติ · ทุกครั้งที่กด “ให้ AI วิเคราะห์เชิงลึก” ในหน้าเหรียญ คำตัดสินจะถูกบันทึกที่นี่ เพื่อดูว่า AI แม่นจริงไหม</p>
      ) : (
        <>
          {bullish.length >= 3 && (
            <p className="mb-3 text-sm">
              คำแนะนำให้ “เข้า/ทยอย” ที่ผ่านมาแล้ว ≥1 วัน: ราคาขึ้นจริง{" "}
              <b className="num">
                {right}/{bullish.length}
              </b>{" "}
              ครั้ง ({((right / bullish.length) * 100).toFixed(0)}%)
            </p>
          )}
          <ul className="divide-y divide-line">
            {calls.slice(0, 15).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                <Link href={`/coin/${encodeURIComponent(c.assetId)}`} className="w-16 font-medium hover:text-accent">
                  {c.symbol}
                </Link>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${VERDICT_CLS[c.verdict] ?? ""}`}>{c.verdict}</span>
                <span className="num text-[11px] text-dim">{c.confidence}%</span>
                <span className="ml-auto text-right">
                  <span className="num block text-xs text-muted">
                    {fmtTHB(c.price)} → {c.now ? fmtTHB(c.now) : "—"}
                  </span>
                  {c.changePct != null && <span className={`num text-[11px] ${c.changePct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(c.changePct, 1)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default function AiChat({ initialInput }: { initialInput: string }) {
  const user = useUser();
  const ai = useAiStream();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialInput);
  const [model, setModel] = useState<"fast" | "deep">("fast");
  const [sharePortfolio, setSharePortfolio] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ai.text, msgs.length]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || ai.loading) return;
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    setInput("");
    const answer = await ai.run("/api/ai/chat", {
      messages: history,
      model,
      portfolio: sharePortfolio ? user.data.portfolio : undefined,
    });
    if (answer.trim()) setMsgs([...history, { role: "assistant", content: answer }]);
    ai.setText("");
  };

  return (
    <main>
      <PageTitle
        title="ผู้ช่วย AI"
        sub="ถามอะไรก็ได้เรื่องคริปโต AI จะดึงภาวะตลาด ผลสแกน และข้อมูลเหรียญที่คุณพิมพ์ชื่อ (เช่น SOL, PEPE) มาใช้ตอบอัตโนมัติ"
        right={
          <Segmented
            value={model}
            onChange={setModel}
            options={[
              { value: "fast", label: "ตอบเร็ว" },
              { value: "deep", label: "คิดลึก" },
            ]}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rise flex min-h-[60vh] flex-col rounded-2xl">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {msgs.length === 0 && !ai.loading && (
              <div>
                <p className="mb-3 text-sm text-muted">ลองถาม:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => send(q)} disabled={!user.user} className="rounded-xl border border-line bg-[#0b1030]/40 px-3 py-2 text-left text-[13px] text-muted transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-fg disabled:opacity-50 disabled:hover:translate-y-0">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-panel-2 px-4 py-2.5 text-sm">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="max-w-full">
                  <Markdown text={m.content} />
                </div>
              ),
            )}
            {ai.loading && (
              <div>
                {ai.text ? <Markdown text={ai.text} /> : null}
                <p className="mt-2 flex items-center gap-2 text-xs text-dim">
                  <span className="live-dot size-1.5 rounded-full bg-accent" />
                  {ai.text ? "กำลังเขียน…" : "กำลังดึงข้อมูลตลาดและคิด…"}
                  <button onClick={ai.stop} className="underline">
                    หยุด
                  </button>
                </p>
              </div>
            )}
            {ai.error && <p className="text-sm text-down">{ai.error}</p>}
            <div ref={bottom} />
          </div>

          {!user.user && user.ready ? (
            <div className="border-t border-line p-4 text-center">
              <p className="mb-3 text-sm text-muted">ผู้ช่วย AI ใช้ได้เฉพาะสมาชิก (ฟรี) เพื่อป้องกันการใช้งานเกินโควตา</p>
              <Link href="/login?next=/ai" className={btn.primary}>
                เข้าสู่ระบบเพื่อคุยกับ AI
              </Link>
            </div>
          ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ถามเช่น “SOL ตอนนี้ควรเข้าไหม ถ้ามีทุน 50,000”"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-dim focus:border-line-2"
              />
              <button disabled={ai.loading || !input.trim()} className={btn.primary}>
                ส่ง
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-dim">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={sharePortfolio} onChange={(e) => setSharePortfolio(e.target.checked)} className="accent-[#8b7cff]" />
                ให้ AI เห็นพอร์ตของฉัน ({user.data.portfolio.length} เหรียญ)
              </label>
              {msgs.length > 0 && (
                <button type="button" onClick={() => setMsgs([])} className="hover:text-fg">
                  เริ่มแชตใหม่
                </button>
              )}
            </div>
          </form>
          )}
        </div>

        <div className="space-y-4">
          <TrackRecord />
          <Card title="AI นี้ทำงานยังไง">
            <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
              <li>อ่านตัวเลขจริงจากระบบทุกครั้งที่ถาม: ราคา คะแนน แนวรับต้าน หลายกรอบเวลา ฟิวเจอร์ส แรงซื้อขาย ความปลอดภัย DEX</li>
              <li>ความมั่นใจยึดกับผลทดสอบย้อนหลังของระบบ (คะแนน 75+ เคยชนะ ~54%) ไม่ใช่ความรู้สึก</li>
              <li>ทุกแผนต้องมีจุดตัดขาดทุนและขนาดไม้ที่เสี่ยงไม่เกิน 1–2% ของพอร์ต</li>
              <li>AI ไม่รู้ข่าวและไม่รู้อนาคต — ใช้เป็นที่ปรึกษา ไม่ใช่หมอดู</li>
            </ul>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </main>
  );
}
