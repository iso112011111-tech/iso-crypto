"use client";

import { useCallback, useRef, useState } from "react";
import { idToken } from "./user";

/** เรียก API ของ AI แบบสตรีม — ข้อความค่อย ๆ โผล่ระหว่างที่ AI กำลังคิด */
export function useAiStream() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cachedAt: number | null; quotaLeft: number | null }>({ cachedAt: null, quotaLeft: null });
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (url: string, body: unknown): Promise<string> => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setText("");
    setError(null);
    setLoading(true);
    let full = "";
    try {
      const token = await idToken();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const cachedAt = res.headers.get("X-Cached-At");
      const quotaLeft = res.headers.get("X-Quota-Left");
      setMeta({ cachedAt: cachedAt ? +cachedAt : null, quotaLeft: quotaLeft ? +quotaLeft : null });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setText(full);
      }
      if (!full.trim()) throw new Error("AI ไม่ได้ตอบกลับ ลองใหม่อีกครั้ง");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
    return full;
  }, []);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setLoading(false);
  }, []);

  return { text, loading, error, meta, run, stop, setText };
}

export function parseVerdict(text: string) {
  const m = text.match(/VERDICT:\s*(เข้า|ทยอย|รอ|หลีกเลี่ยง)\s*\|\s*CONFIDENCE:\s*(\d{1,3})/);
  return m ? { verdict: m[1], confidence: +m[2] } : null;
}

export const VERDICT_CLS: Record<string, string> = {
  เข้า: "border-up/50 text-up",
  ทยอย: "border-fg/40 text-fg",
  รอ: "border-warn/50 text-warn",
  หลีกเลี่ยง: "border-down/50 text-down",
};
