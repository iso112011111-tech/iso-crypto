import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/** ไอคอนแอป (PNG) สำหรับติดตั้งบนมือถือ: /pwa-icon?s=192 หรือ 512 */
export function GET(req: NextRequest) {
  const s = Number(req.nextUrl.searchParams.get("s")) === 512 ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #1d2462, #070b24)" }}>
        <div style={{ position: "relative", width: s * 0.56, height: s * 0.56, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #a78bfa)" }} />
          <div style={{ position: "absolute", left: s * 0.15, top: s * -0.08, width: s * 0.5, height: s * 0.5, borderRadius: "50%", background: "#141a4a" }} />
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
