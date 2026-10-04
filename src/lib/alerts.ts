import "server-only";
import webpush, { type PushSubscription } from "web-push";
import { getStore } from "./store";
import { getUniverse } from "./market";
import { getDexToken } from "./dex";
import { getCoinBundle } from "./coinBundle";
import { mapLimit } from "./http";
import { fmtPct, fmtTHB } from "./format";
import type { AlertRule } from "./alertTypes";

/**
 * แจ้งเตือนเข้ามือถือ (Web Push)
 * เก็บกฎและอุปกรณ์ที่สมัครรับไว้ฝั่งเซิร์ฟเวอร์ แยกตาม uid ของ Firebase
 * ตัวตั้งเวลาเรียก checkAlerts() ทุก 1 นาที
 */

type UserAlerts = { subs: PushSubscription[]; rules: AlertRule[]; fired: Record<string, number> };

const key = (uid: string) => `alerts:${uid}`;
const COOLDOWN_MS = 6 * 3600_000; // กฎแบบเตือนซ้ำ จะเตือนอีกครั้งได้หลัง 6 ชม.

export function pushConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidSet = true;
}

export async function getUserAlerts(uid: string): Promise<UserAlerts> {
  return (await getStore().get<UserAlerts>(key(uid))) ?? { subs: [], rules: [], fired: {} };
}

async function saveUserAlerts(uid: string, a: UserAlerts) {
  const store = getStore();
  await store.set(key(uid), a);
  const index = (await store.get<string[]>("alerts:index")) ?? [];
  if (!index.includes(uid)) await store.set("alerts:index", [...index, uid]);
}

export async function addSubscription(uid: string, sub: PushSubscription) {
  const a = await getUserAlerts(uid);
  a.subs = [sub, ...a.subs.filter((s) => s.endpoint !== sub.endpoint)].slice(0, 10);
  await saveUserAlerts(uid, a);
}

export async function setRules(uid: string, rules: AlertRule[]) {
  const a = await getUserAlerts(uid);
  a.rules = rules.slice(0, 100);
  await saveUserAlerts(uid, a);
}

/** ส่งแจ้งเตือนไปทุกอุปกรณ์ของผู้ใช้ ลบอุปกรณ์ที่ยกเลิกรับแล้วอัตโนมัติ */
export async function sendPush(uid: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured()) return 0;
  ensureVapid();
  const a = await getUserAlerts(uid);
  let sent = 0;
  const alive: PushSubscription[] = [];
  for (const sub of a.subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 });
      alive.push(sub);
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code !== 404 && code !== 410) alive.push(sub); // ผิดพลาดชั่วคราว เก็บไว้ก่อน
    }
  }
  if (alive.length !== a.subs.length) await saveUserAlerts(uid, { ...a, subs: alive });
  return sent;
}

/* ---------- ตรวจเงื่อนไข ---------- */

async function priceOf(assetId: string, universePrices: Map<string, { price: number; change24h: number }>) {
  if (!assetId.startsWith("dex:")) return universePrices.get(assetId) ?? null;
  const [, chain, addr] = assetId.split(":");
  const u = await getUniverse();
  const t = await getDexToken(chain, addr, u.usdThb).catch(() => null);
  return t ? { price: t.price, change24h: t.change24h } : null;
}

let running = false;

export async function checkAlerts(): Promise<{ users: number; checked: number; fired: number }> {
  if (running || !pushConfigured()) return { users: 0, checked: 0, fired: 0 };
  running = true;
  try {
    const store = getStore();
    const index = (await store.get<string[]>("alerts:index")) ?? [];
    const u = await getUniverse();
    const prices = new Map(u.coins.map((c) => [c.symbol, { price: c.price, change24h: c.change24h }]));
    const scoreCache = new Map<string, number | null>();
    let checked = 0;
    let fired = 0;

    await mapLimit(index, 4, async (uid) => {
      const a = await getUserAlerts(uid);
      if (!a.subs.length) return;
      let dirty = false;
      for (const r of a.rules) {
        if (!r.active) continue;
        if (!r.once && a.fired[r.id] && Date.now() - a.fired[r.id] < COOLDOWN_MS) continue;
        checked++;
        const p = await priceOf(r.assetId, prices);
        if (!p) continue;

        let hit = false;
        let body = "";
        if (r.kind === "above" && p.price >= r.value) {
          hit = true;
          body = `ราคาขึ้นถึง ${fmtTHB(p.price)} (ตั้งไว้ ≥ ${fmtTHB(r.value)})`;
        } else if (r.kind === "below" && p.price <= r.value) {
          hit = true;
          body = `ราคาลงถึง ${fmtTHB(p.price)} (ตั้งไว้ ≤ ${fmtTHB(r.value)})`;
        } else if (r.kind === "move" && Math.abs(p.change24h) >= r.value) {
          hit = true;
          body = `ขยับแรง ${fmtPct(p.change24h, 1)} ใน 24 ชม. · ราคา ${fmtTHB(p.price)}`;
        } else if (r.kind === "score") {
          if (!scoreCache.has(r.assetId)) scoreCache.set(r.assetId, await getCoinBundle(r.assetId).then((b) => b.analysis?.score ?? null, () => null));
          const sc = scoreCache.get(r.assetId);
          if (sc != null && sc >= r.value) {
            hit = true;
            body = `Setup Score ขึ้นเป็น ${sc}/100 (ตั้งไว้ ≥ ${r.value}) · ราคา ${fmtTHB(p.price)}`;
          }
        }
        if (!hit) continue;

        await sendPush(uid, {
          title: `${r.symbol} · ${r.note ?? "แจ้งเตือนราคา"}`,
          body,
          url: `/coin/${encodeURIComponent(r.assetId)}`,
          tag: r.id,
        });
        a.fired[r.id] = Date.now();
        if (r.once) r.active = false;
        dirty = true;
        fired++;
      }
      if (dirty) await saveUserAlerts(uid, await mergeFired(uid, a));
    });
    return { users: index.length, checked, fired };
  } finally {
    running = false;
  }
}

/** ระหว่างตรวจ ผู้ใช้อาจแก้กฎ → ใช้กฎล่าสุด แล้วนำสถานะที่เตือนไปแล้วมารวม */
async function mergeFired(uid: string, done: UserAlerts): Promise<UserAlerts> {
  const latest = await getUserAlerts(uid);
  const byId = new Map(done.rules.map((r) => [r.id, r]));
  return {
    ...latest,
    fired: { ...latest.fired, ...done.fired },
    rules: latest.rules.map((r) => (byId.get(r.id)?.active === false && r.once ? { ...r, active: false } : r)),
  };
}
