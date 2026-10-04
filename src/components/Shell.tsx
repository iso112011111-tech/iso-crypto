"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useUser } from "@/hooks/user";
import CoinPicker from "./CoinPicker";
import InstallBanner from "./InstallBanner";
import Sky from "./Sky";
import TickerTape from "./TickerTape";

const NAV = [
  { href: "/", label: "ภาพรวม", icon: "M3 12 12 3l9 9M5 10v10h14V10" },
  { href: "/scanner", label: "สแกนหาจังหวะ", short: "สแกน", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5.2-5.2" },
  { href: "/radar", label: "เรดาร์", icon: "M12 12l7-7M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5" },
  { href: "/alerts", label: "แจ้งเตือน", icon: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" },
  { href: "/ai", label: "ผู้ช่วย AI", short: "AI", icon: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" },
  { href: "/allocator", label: "แบ่งไม้", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/journal", label: "สมุดเทรด", short: "สมุด", icon: "M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h3" },
  { href: "/backtest", label: "ทดสอบ DCA", icon: "M3 3v18h18M7 15l4-4 3 3 6-7" },
  { href: "/accuracy", label: "ความแม่นยำ", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { href: "/account", label: "บัญชี", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];
const MOBILE = ["/", "/scanner", "/ai", "/journal"];
const BARE = ["/login"]; // หน้าที่ไม่มีเมนู (เต็มจอแบบ domeright)

function Icon({ d, className = "size-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <svg viewBox="0 0 24 24" className={`${size === "sm" ? "size-4" : "size-5"} text-accent-2 transition-transform duration-500 group-hover:-rotate-12`} fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
      <span className={`whitespace-nowrap font-semibold tracking-[0.22em] text-fg/90 ${size === "sm" ? "text-[11px]" : "text-[13px]"}`}>ISO-CRYPTO</span>
    </Link>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" width={26} height={26} referrerPolicy="no-referrer" className="rounded-full ring-1 ring-line-2" />
  ) : (
    <span className="grid size-[26px] place-items-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#a78bfa] text-[11px] font-semibold text-white">{name[0]?.toUpperCase()}</span>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useUser();
  const [menu, setMenu] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const go = (id: string) => router.push(`/coin/${encodeURIComponent(id)}`);

  // แสงตามเมาส์บนการ์ด (ใช้ตัวฟังเดียวทั้งหน้า ประหยัดกว่าใส่ทุกการ์ด)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest?.(".glow-card") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  if (BARE.includes(path)) {
    return (
      <>
        <Sky />
        {children}
      </>
    );
  }

  return (
    <>
      <Sky />
      <div className="mx-auto flex max-w-[1480px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 p-3 lg:block">
          <div className="glass flex h-full flex-col rounded-2xl px-3 py-5">
            <div className="px-2">
              <Logo />
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${
                    active(n.href) ? "bg-gradient-to-r from-[#6366f1]/35 to-transparent text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg"
                  }`}
                >
                  {active(n.href) && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent shadow-[0_0_12px_2px_rgba(139,124,255,0.8)]" />}
                  <Icon d={n.icon} className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-2 text-[11px] leading-relaxed text-dim">
              8 กระดาน + DEX ทุกเชน
              <br />
              ไม่ใช่คำแนะนำการลงทุน
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-line bg-[#0a0f2e]/70 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
              <div className="lg:hidden">
                <Logo size="sm" />
              </div>
              <CoinPicker variant="search" onChange={go} className="ml-auto w-full max-w-md lg:ml-0" />
              {user.user ? (
                <Link href="/account" className="hidden shrink-0 items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs text-muted transition hover:border-line-2 hover:text-fg sm:flex lg:ml-auto">
                  <Avatar name={user.user.name} photo={user.user.photo} />
                  <span className="max-w-[120px] truncate">{user.user.name}</span>
                </Link>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn-glow hidden shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-medium text-white sm:block lg:ml-auto">
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
            <TickerTape />
          </header>

          <div key={path} className="px-4 pb-32 pt-6 lg:px-6 lg:pb-12">
            {children}
          </div>
        </div>
      </div>

      <nav className="glass fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-2xl pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${active(n.href) ? "text-accent-2" : "text-muted"}`}>
            <Icon d={n.icon} className={`size-[18px] ${active(n.href) ? "drop-shadow-[0_0_6px_rgba(139,124,255,0.9)]" : ""}`} />
            {n.short ?? n.label}
          </Link>
        ))}
        <button onClick={() => setMenu((v) => !v)} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${menu ? "text-accent-2" : "text-muted"}`}>
          <Icon d="M4 6h16M4 12h16M4 18h16" />
          เมนู
        </button>
      </nav>

      {menu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMenu(false)}>
          <div className="glass rise absolute inset-x-2 bottom-[72px] rounded-2xl p-2" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenu(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active(n.href) ? "bg-white/[0.06] text-fg" : "text-muted"}`}
              >
                <Icon d={n.icon} />
                {n.label}
              </Link>
            ))}
            {!user.user && (
              <Link href="/login" onClick={() => setMenu(false)} className="btn-glow mt-1 block rounded-xl px-3 py-3 text-center text-sm font-medium text-white">
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      )}

      <InstallBanner />
    </>
  );
}
