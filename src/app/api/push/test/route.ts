import { sendPush } from "@/lib/alerts";
import { verifyFirebaseToken } from "@/lib/firebaseVerify";

export const dynamic = "force-dynamic";

/** ส่งแจ้งเตือนทดสอบไปทุกอุปกรณ์ของตัวเอง */
export async function POST(req: Request) {
  const user = await verifyFirebaseToken(req);
  if (!user) return Response.json({ error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const sent = await sendPush(user.uid, { title: "iso-crypto", body: "แจ้งเตือนใช้งานได้แล้ว 🚀 ระบบจะเตือนเมื่อถึงเงื่อนไขที่ตั้งไว้", url: "/alerts", tag: "test" });
  return Response.json({ sent });
}
