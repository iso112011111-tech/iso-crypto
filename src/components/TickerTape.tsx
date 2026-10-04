"use client";

import Link from "next/link";
import { useMarkets } from "@/hooks/data";
import LivePrice from "./LivePrice";

/** แถบราคาวิ่งด้านบน (หยุดเมื่อเอาเมาส์ชี้) */
export default function TickerTape() {
  const m = useMarkets({ limit: 24 });
  const coins = m.data?.coins ?? [];
  if (!coins.length) return <div className="h-8 border-b border-line" />;
  const row = [...coins, ...coins]; // ซ้ำสองชุดให้วิ่งต่อเนื่องไม่สะดุด
  return (
    <div className="relative h-8 overflow-hidden border-b border-line bg-[#0b1030]/40 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
      <div className="marquee flex w-max items-center gap-6 whitespace-nowrap px-4 py-1.5 text-xs">
        {row.map((c, i) => (
          <Link key={`${c.symbol}-${i}`} href={`/coin/${c.symbol}`} className="flex items-center gap-1.5 hover:text-fg">
            <span className="font-medium text-muted">{c.symbol}</span>
            <LivePrice value={c.price} className="text-fg" />
            <span className={`num ${c.change24h >= 0 ? "text-up" : "text-down"}`}>
              {c.change24h >= 0 ? "▲" : "▼"}
              {Math.abs(c.change24h).toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
