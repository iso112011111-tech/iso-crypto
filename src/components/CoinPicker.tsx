"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCoinList } from "@/hooks/data";
import { THAI_NAMES } from "@/lib/coins";
import { fmtCompactTHB } from "@/lib/format";
import type { DexToken, ExchangeQuote } from "@/lib/types";
import { CoinIcon } from "./ui";

const EX: Record<ExchangeQuote["ex"], { short: string; name: string }> = {
  binance: { short: "BN", name: "Binance" },
  okx: { short: "OKX", name: "OKX" },
  bybit: { short: "BY", name: "Bybit" },
  gate: { short: "GT", name: "Gate" },
  mexc: { short: "MX", name: "MEXC" },
  kucoin: { short: "KC", name: "KuCoin" },
  bitkub: { short: "BK", name: "Bitkub" },
  binanceth: { short: "BTH", name: "Binance TH" },
};

export const exName = (ex: ExchangeQuote["ex"]) => EX[ex].name;

export function ExchangeBadges({ list, max = 7, nowrap = false }: { list: ExchangeQuote[]; max?: number; nowrap?: boolean }) {
  return (
    <span className={`inline-flex gap-1 ${nowrap ? "whitespace-nowrap" : "flex-wrap"}`}>
      {list.slice(0, max).map((q) => (
        <span
          key={q.ex}
          title={EX[q.ex].name}
          className={`rounded border px-1 text-[9px] leading-4 ${q.ex === "bitkub" || q.ex === "binanceth" ? "border-up/40 text-up" : "border-line-2 text-muted"}`}
        >
          {EX[q.ex].short}
        </span>
      ))}
      {list.length > max && <span className="text-[9px] leading-4 text-dim">+{list.length - max}</span>}
    </span>
  );
}

/** จำชื่อ/โลโก้ของเหรียญ DEX ที่เคยเลือก เพื่อแสดงบนปุ่มได้ทันที */
const dexMeta = new Map<string, { symbol: string; image?: string; chainName: string }>();
export const rememberDex = (t: Pick<DexToken, "id" | "symbol" | "image" | "chainName">) =>
  dexMeta.set(t.id, { symbol: t.symbol, image: t.image, chainName: t.chainName });

type Item =
  | { kind: "cex"; id: string; symbol: string; name: string; img?: string; sub: string }
  | { kind: "dex"; id: string; symbol: string; name: string; img?: string; sub: string; token: DexToken };

function useDexSearch(q: string) {
  const [res, setRes] = useState<{ q: string; items: DexToken[] }>({ q: "", items: [] });
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/dex/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((items: DexToken[]) => setRes({ q: term, items }))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);
  const done = res.q === q.trim();
  return { items: done ? res.items : [], pending: q.trim().length >= 2 && !done };
}

/**
 * ช่องค้นหาเหรียญ — ทุกกระดาน + DEX ทุกเชน (พิมพ์ชื่อ สัญลักษณ์ หรือที่อยู่คอนแทรกต์)
 * variant="search" ใช้เป็นช่องค้นหาด้านบน (ไม่มีค่าที่เลือก)
 */
export default function CoinPicker({
  value,
  onChange,
  variant = "select",
  className = "",
}: {
  value?: string;
  onChange: (id: string) => void;
  variant?: "select" | "search";
  className?: string;
}) {
  const list = useCoinList();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const { items: dex, pending: dexPending } = useDexSearch(open ? q : "");

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items: Item[] = useMemo(() => {
    const t = q.trim().toUpperCase();
    const cex = !t
      ? list.slice(0, 30)
      : [
          ...list.filter((c) => c.s === t),
          ...list.filter((c) => c.s !== t && c.s.startsWith(t)),
          ...list.filter((c) => !c.s.startsWith(t) && (c.n.toUpperCase().includes(t) || THAI_NAMES[c.s]?.includes(q.trim()))),
        ].slice(0, 20);
    const cexSymbols = new Set(cex.map((c) => c.s));
    return [
      ...cex.map((c): Item => ({ kind: "cex", id: c.s, symbol: c.s, name: THAI_NAMES[c.s] ?? c.n, img: c.img, sub: c.r ? `#${c.r}` : `${c.ex} กระดาน` })),
      ...dex
        // ซ่อนเหรียญ DEX ที่ชื่อซ้ำกับเหรียญใหญ่บนกระดานและสภาพคล่องน้อย (มักเป็นของปลอม)
        .filter((d) => !(cexSymbols.has(d.symbol.toUpperCase()) && d.liquidity < 5_000_000))
        .map((d): Item => ({ kind: "dex", id: d.id, symbol: d.symbol, name: d.name, img: d.image, sub: `${d.chainName} · ${fmtCompactTHB(d.liquidity)}`, token: d })),
    ];
  }, [list, q, dex]);

  const pick = (it: Item) => {
    if (it.kind === "dex") rememberDex(it.token);
    onChange(it.id);
    setOpen(false);
    setQ("");
  };

  const cur = value ? list.find((c) => c.s === value) : undefined;
  const dm = value ? dexMeta.get(value) : undefined;
  const label = cur?.s ?? dm?.symbol ?? (value?.startsWith("dex:") ? `${value.split(":")[2]?.slice(0, 6)}…` : value);

  return (
    <div ref={box} className={`relative ${className}`}>
      {variant === "search" ? (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-line-2">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-dim" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
              setOpen(true);
            }}
            onKeyDown={(e) => keys(e)}
            placeholder="ค้นหาเหรียญ ชื่อ หรือที่อยู่คอนแทรกต์…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-dim"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-[170px] items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-left text-sm hover:border-line-2"
        >
          <CoinIcon src={cur?.img ?? dm?.image} symbol={label ?? "?"} size={18} />
          <span className="font-medium">{label}</span>
          <span className="truncate text-xs text-dim">{cur ? (THAI_NAMES[cur.s] ?? cur.n) : dm?.chainName}</span>
          <span className="ml-auto text-dim">▾</span>
        </button>
      )}

      {open && (variant === "select" || q.trim()) && (
        <div className="absolute left-0 z-50 mt-1.5 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl shadow-black/60">
          {variant === "select" && (
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => keys(e)}
              placeholder={`ค้นหาจาก ${list.length.toLocaleString("th-TH")} เหรียญ + DEX…`}
              className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-dim"
            />
          )}
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.length === 0 && <li className="px-3 py-3 text-xs text-dim">{list.length ? "ไม่พบเหรียญ" : "กำลังโหลด…"}</li>}
            {items.map((it, i) => (
              <li key={it.id}>
                {i > 0 && it.kind === "dex" && items[i - 1].kind === "cex" && (
                  <div className="mt-1 border-t border-line px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-dim">DEX · ระวังเหรียญปลอม</div>
                )}
                {i === 0 && it.kind === "dex" && <div className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wider text-dim">DEX · ระวังเหรียญปลอม</div>}
                <button
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(it)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${i === hi ? "bg-panel-2" : ""}`}
                >
                  <CoinIcon src={it.img} symbol={it.symbol} size={18} />
                  <span className="font-medium">{it.symbol}</span>
                  <span className="truncate text-xs text-dim">{it.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-dim">{it.sub}</span>
                </button>
              </li>
            ))}
            {dexPending && <li className="px-3 py-2 text-[11px] text-dim">กำลังค้นหาบน DEX…</li>}
          </ul>
        </div>
      )}
    </div>
  );

  function keys(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, items.length - 1));
    else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
    else if (e.key === "Enter" && items[hi]) pick(items[hi]);
    else if (e.key === "Escape") setOpen(false);
  }
}
