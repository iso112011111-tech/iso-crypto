import { getCoinList } from "@/lib/market";

export const dynamic = "force-dynamic";

/** รายชื่อเหรียญทั้งหมดจากทุกกระดาน (แบบย่อ) สำหรับช่องค้นหา */
export async function GET() {
  try {
    return Response.json(await getCoinList());
  } catch (e) {
    return Response.json({ error: "ดึงรายชื่อเหรียญไม่สำเร็จ", detail: String(e) }, { status: 502 });
  }
}
