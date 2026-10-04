"use client";

import { useCallback, useEffect, useState } from "react";
import { idToken, useUser } from "./user";
import type { AlertRule } from "@/lib/alertTypes";

async function authed(url: string, init: RequestInit = {}) {
  const token = await idToken();
  if (!token) throw new Error("เข้าสู่ระบบก่อน");
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushState = "unsupported" | "denied" | "default" | "granted";

/** กฎแจ้งเตือนของผู้ใช้ (เก็บฝั่งเซิร์ฟเวอร์ เพราะเซิร์ฟเวอร์เป็นคนตรวจทุกนาที) */
export function useAlerts() {
  const user = useUser();
  const [rules, setRulesState] = useState<AlertRule[]>([]);
  const [fired, setFired] = useState<Record<string, number>>({});
  const [devices, setDevices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const uid = user.user?.uid;

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  // โหลดกฎจากเซิร์ฟเวอร์เมื่อล็อกอินแล้ว หรือเมื่อสั่งโหลดใหม่
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    authed("/api/alerts")
      .then((d) => {
        if (!alive) return;
        setRulesState(d.rules);
        setFired(d.fired);
        setDevices(d.devices);
        setError(null);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uid, tick]);

  const save = async (next: AlertRule[]) => {
    setRulesState(next);
    try {
      await authed("/api/alerts", { method: "PUT", body: JSON.stringify({ rules: next }) });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return { rules, fired, devices, loading: loading && !!uid, error, save, reload };
}

export function pushState(): PushState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission as PushState;
}

/** ขออนุญาต + สมัครรับแจ้งเตือนบนอุปกรณ์นี้ */
export async function enablePush(): Promise<string | null> {
  if (pushState() === "unsupported")
    return "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน · บน iPhone ต้อง “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนแอปก่อน (iOS 16.4 ขึ้นไป)";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "ยังไม่ได้อนุญาตการแจ้งเตือน — เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์";
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
    await authed("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
    return null;
  } catch (e) {
    return `สมัครรับแจ้งเตือนไม่สำเร็จ: ${(e as Error).message}`;
  }
}

export async function testPush(): Promise<number> {
  const d = await authed("/api/push/test", { method: "POST" });
  return d.sent;
}
