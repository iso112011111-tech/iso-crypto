"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loginEmail, loginGoogle, registerEmail, resetPassword, useUser } from "@/hooks/user";
import { Logo } from "@/components/Shell";

type Mode = "login" | "register" | "reset";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/** ไอคอนคนเดินเข้าประตู (เหมือนปุ่มของ domeright) — ตอนชี้เมาส์คนจะเดินเข้าไป */
function DoorIcon() {
  return (
    <span className="relative flex h-7 w-12 items-end justify-end">
      <svg viewBox="0 0 12 28" className="absolute bottom-0 left-1 h-7 transition-transform duration-500 group-hover:translate-x-5" fill="none" stroke="white" strokeWidth={1.6} strokeLinecap="round">
        <circle cx="6" cy="4" r="2.4" fill="white" stroke="none" />
        <path d="M6 7v10M6 17l-3 9M6 17l3 9M6 10l-3.5 5M6 10l3.5 5" />
      </svg>
      <span className="relative h-7 w-[18px] rounded-[3px] border-2 border-white/90 bg-[#1e1b5e]">
        <span className="absolute right-0.5 top-1/2 size-1 -translate-y-1/2 rounded-full bg-white" />
      </span>
    </span>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const user = useUser();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ล็อกอินแล้ว → กลับไปหน้าที่มา
  useEffect(() => {
    if (user.user) router.replace(next.startsWith("/") ? next : "/");
  }, [user.user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    if (mode === "reset") {
      const err = await resetPassword(email);
      if (err) setError(err);
      else setInfo("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว (ถ้ามีบัญชีนี้) — เช็คกล่องจดหมายและสแปม");
    } else {
      const err = mode === "login" ? await loginEmail(email, password, remember) : await registerEmail(name, email, password);
      if (err) setError(err);
    }
    setBusy(false);
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const err = await loginGoogle(remember);
    if (err) setError(err);
    setBusy(false);
  };

  const input =
    "w-full rounded-xl border border-line bg-[#0b1030]/60 px-4 py-3 text-sm outline-none transition placeholder:text-dim focus:border-accent/70 focus:shadow-[0_0_0_4px_rgba(139,124,255,0.15)]";

  const title = { login: "ยินดีต้อนรับกลับ", register: "สร้างบัญชีใหม่", reset: "ลืมรหัสผ่าน" }[mode];
  const sub = {
    login: "เข้าสู่ระบบเพื่อซิงก์พอร์ต สมุดเทรด และใช้ผู้ช่วย AI",
    register: "ฟรี · ข้อมูลของคุณเก็บแยกเป็นส่วนตัว ใช้ได้ทุกเครื่อง",
    reset: "ใส่อีเมลที่สมัครไว้ เราจะส่งลิงก์ตั้งรหัสใหม่ให้",
  }[mode];

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass rise w-full max-w-[400px] rounded-3xl p-7 sm:p-8">
        <Logo size="sm" />
        <h1 className="mt-6 text-[26px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{sub}</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "register" && <input className={input} placeholder="ชื่อที่ให้แสดง" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          <input className={input} type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {mode !== "reset" && (
            <div className="relative">
              <input
                className={`${input} pr-11`}
                type={showPw ? "text" : "password"}
                placeholder={mode === "register" ? "รหัสผ่าน (อย่างน้อย 6 ตัว)" : "รหัสผ่าน"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-fg" aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {!showPw && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </div>
          )}

          {mode === "login" && (
            <div className="flex items-center justify-between text-[13px]">
              <label className="flex cursor-pointer items-center gap-2 text-muted">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[#8b7cff]" />
                จดจำฉันไว้
              </label>
              <button type="button" onClick={() => setMode("reset")} className="text-accent-2 hover:underline">
                ลืมรหัสผ่าน?
              </button>
            </div>
          )}

          {error && <p className="rise rounded-lg bg-down/10 px-3 py-2 text-[13px] text-down">{error}</p>}
          {info && <p className="rise rounded-lg bg-up/10 px-3 py-2 text-[13px] text-up">{info}</p>}

          <button disabled={busy} className="btn-glow group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "กำลังดำเนินการ…" : { login: "เข้าสู่ระบบ", register: "สมัครสมาชิก", reset: "ส่งลิงก์ตั้งรหัสใหม่" }[mode]}
            <DoorIcon />
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="my-6 flex items-center gap-3 text-[12px] text-dim">
              <span className="h-px flex-1 bg-line" />
              หรือเข้าสู่ระบบด้วย
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              onClick={google}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-[#0b1030]/60 py-2.5 text-sm transition hover:border-line-2 hover:bg-white/[0.04] active:scale-[0.98] disabled:opacity-60"
            >
              <GoogleIcon />
              Google
            </button>
          </>
        )}

        <p className="mt-6 text-center text-[13px] text-muted">
          {mode === "login" ? (
            <>
              ยังไม่มีบัญชี?{" "}
              <button onClick={() => setMode("register")} className="text-accent-2 hover:underline">
                สมัครสมาชิก
              </button>
            </>
          ) : (
            <>
              มีบัญชีแล้ว?{" "}
              <button onClick={() => setMode("login")} className="text-accent-2 hover:underline">
                เข้าสู่ระบบ
              </button>
            </>
          )}
        </p>
        <p className="mt-3 text-center">
          <Link href={next} className="text-[12px] text-dim hover:text-fg">
            ใช้งานต่อโดยไม่เข้าสู่ระบบ →
          </Link>
        </p>
      </div>
    </main>
  );
}
