import "server-only";
import { aiConfigured, rateLimited } from "./ai";
import { verifyFirebaseToken } from "./firebaseVerify";

/** ด่านตรวจก่อนเรียก AI: ตั้งค่าคีย์แล้วไหม / ล็อกอินแล้วไหม / ถี่เกินไหม — คืน uid ไว้นับโควตา */
export async function aiGuard(req: Request): Promise<Response | { uid: string }> {
  if (!aiConfigured()) return Response.json({ error: "ยังไม่ได้ตั้งค่า AI_API_KEY และ AI_BASE_URL" }, { status: 503 });
  // AI ใช้เครดิตของเจ้าของเว็บ → เฉพาะสมาชิกที่ล็อกอินแล้ว (ปิดได้ด้วย AI_REQUIRE_LOGIN=0 สำหรับทดสอบในเครื่อง)
  const user = await verifyFirebaseToken(req);
  if (process.env.AI_REQUIRE_LOGIN !== "0" && !user) return Response.json({ error: "เข้าสู่ระบบก่อนใช้ AI", needLogin: true }, { status: 401 });
  const key = user?.uid ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(key)) return Response.json({ error: "ใช้ AI ถี่เกินไป ลองใหม่ในอีกสักครู่" }, { status: 429 });
  return { uid: key };
}

export const streamHeaders = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" };
