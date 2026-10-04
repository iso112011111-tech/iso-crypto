"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/** ค่าเชื่อมต่อ Firebase ฝั่งเว็บ (เปิดเผยได้ — ความปลอดภัยของข้อมูลอยู่ที่ firestore.rules) */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = !!config.apiKey && !!config.projectId;

let app: FirebaseApp | null = null;
export function fbApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}
export const fbAuth = (): Auth => getAuth(fbApp());
export const fbDb = (): Firestore => getFirestore(fbApp());

/** Analytics โหลดเฉพาะเบราว์เซอร์ที่รองรับ (ไม่ทำให้หน้าเว็บพังถ้าโดนบล็อก) */
export async function startAnalytics() {
  if (!config.measurementId || typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(fbApp());
  } catch {
    /* ตัวบล็อกโฆษณาอาจบล็อก ไม่เป็นไร */
  }
}
