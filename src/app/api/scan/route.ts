import type { NextRequest } from "next/server";
import { runScan } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await runScan(req.nextUrl.searchParams.get("set") ?? "top50");
  if (result.rows.length === 0) return Response.json({ error: "สแกนไม่สำเร็จ" }, { status: 502 });
  return Response.json(result);
}
