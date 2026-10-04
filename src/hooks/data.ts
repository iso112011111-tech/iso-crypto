"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoinLite, CoinResponse, MarketsResponse, ScanRow } from "@/lib/types";

/**
 * fetch JSON พร้อมสถานะโหลด/ผิดพลาด, refreshMs > 0 จะดึงซ้ำเป็นระยะ
 * ข้อมูลผูกกับ url: เปลี่ยน url แล้วจะไม่โชว์ข้อมูลของ url เก่าค้างไว้
 */
export function useJSON<T>(url: string | null, refreshMs = 0) {
  const [state, setState] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const key = `${url}#${tick}`;
  const [doneKey, setDoneKey] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as T;
      })
      .then((data) => alive && setState({ url, data, error: null }))
      .catch((e) => {
        if (!alive || e.name === "AbortError") return;
        // ถ้าเป็นการรีเฟรชแล้วพลาด ให้เก็บข้อมูลเดิมไว้
        setState((prev) => ({ url, data: prev?.url === url ? prev.data : null, error: String(e.message ?? e) }));
      })
      .finally(() => alive && setDoneKey(`${url}#${tick}`));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [url, tick]);

  useEffect(() => {
    if (!refreshMs) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const mine = state?.url === url ? state : null;
  return {
    data: mine?.data ?? null,
    error: mine?.error ?? null,
    loading: doneKey !== key,
    reload: () => setTick((t) => t + 1),
  };
}

/** id = "BTC" หรือ "dex:<chain>:<address>" */
export const useCoin = (id: string | null, refreshMs = 0) =>
  useJSON<CoinResponse>(id ? `/api/coin?id=${encodeURIComponent(id)}` : null, refreshMs);

export type ScanResult = { rows: ScanRow[]; skipped: number; set: string; label: string; scannedAt: number };
export const useScan = (set: string) => useJSON<ScanResult>(`/api/scan?set=${set}`, 3 * 60_000); // สแกนใหม่ทุก 3 นาที

/* ---------- รายชื่อเหรียญทั้งหมด (โหลดครั้งเดียวต่อการเปิดหน้า) ---------- */
let coinListPromise: Promise<CoinLite[]> | null = null;

export function useCoinList(): CoinLite[] {
  const [list, setList] = useState<CoinLite[]>([]);
  useEffect(() => {
    coinListPromise ??= fetch("/api/coins")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        coinListPromise = null;
        return [];
      });
    let alive = true;
    coinListPromise.then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

/* ---------- ราคาสดผ่าน WebSocket ---------- */
export type LiveTick = { priceUsd: number; change24h: number; at: number };

const WS_HOSTS = ["wss://stream.binance.com:9443", "wss://data-stream.binance.vision"];

/**
 * ราคาสดของเหรียญที่มีบน Binance (miniTicker) — อัปเดตทุก ~1 วินาที
 * เหรียญที่อยู่กระดานอื่นอย่างเดียวจะใช้ราคาจาก /api/markets ที่รีเฟรชทุก 20 วินาที
 */
export function useLivePrices(symbols: string[]): Record<string, LiveTick> {
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({});
  const buffer = useRef<Record<string, LiveTick>>({});
  const key = [...symbols].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let ws: WebSocket | null = null;
    let hostIdx = 0;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const list = key.split(",");
    const pairToSymbol = new Map(list.map((s) => [`${s}USDT`, s]));
    const streams = list.map((s) => `${s.toLowerCase()}usdt@miniTicker`).join("/");

    const connect = () => {
      ws = new WebSocket(`${WS_HOSTS[hostIdx]}/stream?streams=${streams}`);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as { data?: { s: string; c: string; o: string } };
        const sym = msg.data && pairToSymbol.get(msg.data.s);
        if (!sym || !msg.data) return;
        const c = +msg.data.c;
        const o = +msg.data.o;
        buffer.current[sym] = { priceUsd: c, change24h: (c / o - 1) * 100, at: Date.now() };
      };
      ws.onclose = () => {
        if (closed) return;
        hostIdx = (hostIdx + 1) % WS_HOSTS.length;
        retry = setTimeout(connect, 3000);
      };
    };
    connect();

    // รวบอัปเดตเป็นรอบละ 1 วินาที เพื่อไม่ให้ React render ถี่เกินไป
    const flush = setInterval(() => {
      if (Object.keys(buffer.current).length) {
        const next = buffer.current;
        buffer.current = {};
        setTicks((prev) => ({ ...prev, ...next }));
      }
    }, 1000);

    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(flush);
      ws?.close();
    };
  }, [key]);

  return ticks;
}

export type MarketParams = { sort?: string; filter?: string; q?: string; limit?: number; symbols?: string[] };

/** ภาพรวมตลาด + ทับราคาเหรียญที่อยู่บน Binance ด้วยราคาสด */
export function useMarkets(params: MarketParams = {}) {
  const qs = new URLSearchParams();
  if (params.sort) qs.set("sort", params.sort);
  if (params.filter) qs.set("filter", params.filter);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.symbols) qs.set("symbols", params.symbols.join(","));
  const skip = params.symbols && params.symbols.length === 0;
  const res = useJSON<MarketsResponse>(skip ? null : `/api/markets?${qs}`, 15_000);

  const binanceSymbols = useMemo(
    () => (res.data?.coins ?? []).filter((c) => c.exchanges.some((e) => e.ex === "binance")).map((c) => c.symbol),
    [res.data],
  );
  const live = useLivePrices(binanceSymbols);

  const data = res.data
    ? {
        ...res.data,
        coins: res.data.coins.map((c) => {
          const t = live[c.symbol];
          // ใช้ราคาสดเฉพาะเมื่อ Binance เป็นกระดานอ้างอิงหลัก เพื่อไม่ให้ราคากระโดดไปมาระหว่างกระดาน
          return t && c.exchanges[0]?.ex === "binance"
            ? { ...c, price: t.priceUsd * res.data!.usdThb, change24h: t.change24h }
            : c;
        }),
      }
    : null;
  return { ...res, data, isLive: Object.keys(live).length > 0 };
}
