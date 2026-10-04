"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { fbAuth, fbDb, firebaseConfigured, startAnalytics } from "@/lib/firebase";
import type { UserData } from "@/lib/types";

/**
 * ข้อมูลส่วนตัว (พอร์ต, รายการโปรด, สมุดเทรด)
 * - ยังไม่ล็อกอิน: เก็บในเบราว์เซอร์
 * - ล็อกอินแล้ว: เก็บใน Firestore ที่ users/{uid} ซิงก์ทุกเครื่องแบบเรียลไทม์
 */
export type Profile = { uid: string; name: string; email: string | null; photo: string | null };
type State = { data: UserData; user: Profile | null; username: string | null; ready: boolean; syncing: boolean; error: string | null };

const KEY = "iso-crypto:data";
const LEGACY_PORTFOLIO = "iso-crypto:portfolio";
const EMPTY: UserData = { portfolio: [], watchlist: [], journal: [], updatedAt: 0 };
const SERVER_STATE: State = { data: EMPTY, user: null, username: null, ready: false, syncing: false, error: null };

let state: State = SERVER_STATE;
const listeners = new Set<() => void>();
const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

function readLocal(): UserData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    const legacy = localStorage.getItem(LEGACY_PORTFOLIO);
    if (legacy) return { ...EMPTY, portfolio: JSON.parse(legacy) };
  } catch {
    /* ไม่มีหรืออ่านไม่ได้ */
  }
  return EMPTY;
}
function writeLocal(d: UserData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* โหมดส่วนตัวอาจบันทึกไม่ได้ */
  }
}

const isEmpty = (d: UserData) => !d.portfolio.length && !d.watchlist.length && !d.journal.length;

// Firestore ไม่รับค่า undefined → ล้างทิ้งก่อนบันทึก
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

let currentUser: User | null = null;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    setState({ syncing: true });
    try {
      const { portfolio, watchlist, journal, updatedAt } = state.data;
      await setDoc(doc(fbDb(), "users", uid), clean({ portfolio, watchlist, journal, updatedAt, profile: { name: state.user?.name ?? "", email: state.user?.email ?? null } }));
      setState({ syncing: false, error: null });
    } catch (e) {
      setState({ syncing: false, error: `ซิงก์ไม่สำเร็จ: ${(e as Error).message}` });
    }
  }, 600);
}

let unsubDoc: Unsubscribe | null = null;
function watchUserDoc(user: User) {
  unsubDoc?.();
  let first = true;
  unsubDoc = onSnapshot(
    doc(fbDb(), "users", user.uid),
    (snap) => {
      const cloud = snap.exists() ? ({ ...EMPTY, ...snap.data() } as UserData) : null;
      if (first) {
        first = false;
        // ครั้งแรกที่ล็อกอิน: บนคลาวด์ยังว่างแต่ในเครื่องมีของ → ย้ายขึ้นคลาวด์ให้
        if ((!cloud || isEmpty(cloud)) && !isEmpty(state.data)) {
          schedulePush();
          return;
        }
      }
      // ไม่ทับข้อมูลที่เพิ่งแก้ในเครื่องและยังไม่ได้ส่งขึ้น
      if (cloud && !snap.metadata.hasPendingWrites && cloud.updatedAt >= state.data.updatedAt) {
        setState({ data: cloud });
        writeLocal(cloud);
      }
    },
    (e) => setState({ error: `อ่านข้อมูลบนคลาวด์ไม่ได้: ${e.message}` }),
  );
}

const toProfile = (u: User): Profile => ({ uid: u.uid, name: u.displayName || u.email?.split("@")[0] || "ผู้ใช้", email: u.email, photo: u.photoURL });

let started = false;
function init() {
  if (started) return;
  started = true;
  setState({ data: readLocal() });
  if (!firebaseConfigured) {
    setState({ ready: true, error: "ยังไม่ได้ตั้งค่า Firebase" });
    return;
  }
  startAnalytics();
  onAuthStateChanged(fbAuth(), (u) => {
    currentUser = u;
    if (u) {
      const p = toProfile(u);
      setState({ user: p, username: p.name, ready: true });
      watchUserDoc(u);
    } else {
      unsubDoc?.();
      unsubDoc = null;
      setState({ user: null, username: null, ready: true });
    }
  });
}

export function updateData(fn: (d: UserData) => UserData) {
  const data = { ...fn(state.data), updatedAt: Date.now() };
  setState({ data });
  writeLocal(data);
  schedulePush();
}

/* ---------- เข้าสู่ระบบ ---------- */

const ERR_TH: Record<string, string> = {
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/email-already-in-use": "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/weak-password": "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร",
  "auth/too-many-requests": "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
  "auth/popup-closed-by-user": "ปิดหน้าต่าง Google ก่อนเข้าสู่ระบบเสร็จ",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่าง Google — อนุญาตป๊อปอัปแล้วลองใหม่",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดวิธีเข้าสู่ระบบนี้ใน Firebase Console",
  "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่ได้",
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase (Authentication → Settings → Authorized domains)",
};
const thaiError = (e: unknown) => {
  const code = (e as { code?: string }).code ?? "";
  return ERR_TH[code] ?? `เกิดข้อผิดพลาด (${code || (e as Error).message})`;
};

async function persistence(remember: boolean) {
  await setPersistence(fbAuth(), remember ? browserLocalPersistence : browserSessionPersistence);
}

export async function loginGoogle(remember = true): Promise<string | null> {
  try {
    await persistence(remember);
    await signInWithPopup(fbAuth(), new GoogleAuthProvider());
    return null;
  } catch (e) {
    return thaiError(e);
  }
}

export async function loginEmail(email: string, password: string, remember = true): Promise<string | null> {
  try {
    await persistence(remember);
    await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
    return null;
  } catch (e) {
    return thaiError(e);
  }
}

export async function registerEmail(name: string, email: string, password: string): Promise<string | null> {
  try {
    await persistence(true);
    const cred = await createUserWithEmailAndPassword(fbAuth(), email.trim(), password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      setState({ user: toProfile(cred.user), username: name.trim() });
    }
    return null;
  } catch (e) {
    return thaiError(e);
  }
}

export async function resetPassword(email: string): Promise<string | null> {
  try {
    await sendPasswordResetEmail(fbAuth(), email.trim());
    return null;
  } catch (e) {
    return thaiError(e);
  }
}

export async function logout() {
  await signOut(fbAuth());
}

/** โทเคนยืนยันตัวตน แนบไปกับคำขอที่ต้องล็อกอิน (เช่น AI) */
export async function idToken(): Promise<string | null> {
  return currentUser ? currentUser.getIdToken() : null;
}

export function useUser() {
  useEffect(() => {
    init();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER_STATE,
  );
}

export function toggleWatch(id: string) {
  updateData((d) => ({
    ...d,
    watchlist: d.watchlist.includes(id) ? d.watchlist.filter((x) => x !== id) : [id, ...d.watchlist],
  }));
}
