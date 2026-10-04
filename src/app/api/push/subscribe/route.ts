import type { PushSubscription } from "web-push";
import { addSubscription } from "@/lib/alerts";
import { verifyFirebaseToken } from "@/lib/firebaseVerify";

export const dynamic = "force-dynamic";

/** บันทึกอุปกรณ์ที่อนุญาตให้ส่งแจ้งเตือน */
export async function POST(req: Request) {
  const user = await verifyFirebaseToken(req);
  if (!user) return Response.json({ error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const sub = (await req.json().catch(() => null)) as PushSubscription | null;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return Response.json({ error: "ข้อมูลอุปกรณ์ไม่ถูกต้อง" }, { status: 400 });
  await addSubscription(user.uid, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return Response.json({ ok: true });
}
