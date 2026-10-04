"use client";

import { useEffect, useState } from "react";
import { btn } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "iso-crypto:install-dismissed";

/** แบนเนอร์ชวนติดตั้งเป็นแอปบนมือถือ (Android กดติดตั้งได้เลย, iPhone แสดงวิธีเพิ่มลงหน้าจอโฮม) */
export default function InstallBanner() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(KEY) ?? 0);
    } catch {
      /* อ่านไม่ได้ ถือว่ายังไม่เคยปิด */
    }
    if (standalone || Date.now() - dismissedAt < 7 * 86_400_000) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // iPhone/iPad ไม่มีปุ่มติดตั้งอัตโนมัติ → แสดงวิธีทำเอง
    const t = setTimeout(() => {
      if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        setIos(true);
        setShow(true);
      }
    }, 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* บันทึกไม่ได้ ไม่เป็นไร */
    }
  };

  const install = async () => {
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setShow(false);
    } else setHowto(true);
  };

  if (!show) return null;
  return (
    <div className="rise fixed inset-x-3 bottom-[76px] z-50 mx-auto max-w-lg lg:bottom-5">
      <div className="glass flex items-center gap-3 rounded-2xl p-3 pr-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa-icon?s=192" alt="" width={44} height={44} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">ติดตั้งแอป iso-crypto</div>
          <div className="text-[12px] text-muted">เปิดได้ในแตะเดียว เต็มจอ ลื่นกว่า ไม่ต้องพิมพ์เว็บอีก</div>
          {howto && ios && <div className="mt-1.5 text-[12px] text-fg">แตะปุ่ม แชร์ (สี่เหลี่ยมมีลูกศรขึ้น) ใน Safari → “เพิ่มไปยังหน้าจอโฮม”</div>}
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={install} className={`${btn.primary} px-3 py-1.5 text-xs`}>
            {evt ? "ติดตั้ง" : "วิธีติดตั้ง"}
          </button>
          <button onClick={dismiss} className="text-[11px] text-dim hover:text-fg">
            ไว้ทีหลัง
          </button>
        </div>
      </div>
    </div>
  );
}
