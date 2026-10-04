import type { NextRequest } from "next/server";
import { runValidation } from "@/lib/validateRun";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const top = [20, 40].includes(Number(p.get("top"))) ? Number(p.get("top")) : 20;
  const horizon = [14, 30].includes(Number(p.get("horizon"))) ? Number(p.get("horizon")) : 30;
  try {
    return Response.json(await runValidation(top, horizon));
  } catch (e) {
    return Response.json({ error: "ทดสอบไม่สำเร็จ", detail: String(e) }, { status: 502 });
  }
}
