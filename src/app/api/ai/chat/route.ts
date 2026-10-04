import { SYSTEM_PROMPT, compactCoin, marketContext, mentionedCoins, scoreStats, streamChat, type ChatMessage, type ModelKey } from "@/lib/ai";
import { aiGuard, streamHeaders } from "@/lib/aiGuard";
import { getCoinBundle } from "@/lib/coinBundle";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = { messages?: { role: "user" | "assistant"; content: string }[]; model?: ModelKey; portfolio?: Holding[] };

/** แชตกับ iso AI: แนบภาวะตลาด ผลสแกน และข้อมูลเหรียญที่ถูกพูดถึงให้อัตโนมัติ */
export async function POST(req: Request) {
  const blocked = await aiGuard(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Body;
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const last = history.filter((m) => m.role === "user").at(-1)?.content;
  if (!last) return Response.json({ error: "ไม่มีข้อความ" }, { status: 400 });

  try {
    const ids = await mentionedCoins(last);
    const [market, stats, coins] = await Promise.all([
      marketContext(),
      scoreStats(),
      Promise.all(ids.map((id) => getCoinBundle(id).then(compactCoin).catch(() => null))),
    ]);
    const portfolio = Array.isArray(body.portfolio) && body.portfolio.length ? body.portfolio.slice(0, 30) : undefined;
    const data = { market, scoreStats: stats, coins: coins.filter(Boolean), portfolio };

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nข้อมูลล่าสุดจากระบบ (อัปเดตทุกครั้งที่ผู้ใช้ถาม):\n<data>\n${JSON.stringify(data)}\n</data>\n\nตอบเป็นบทสนทนา กระชับ ไม่ต้องใส่บรรทัด VERDICT ถ้าผู้ใช้ถามเหรียญที่ไม่มีใน data ให้บอกว่ายังไม่มีข้อมูลและแนะนำให้พิมพ์สัญลักษณ์เหรียญ (เช่น SOL) หรือค้นจากช่องค้นหา`,
      },
      ...history,
    ];
    const stream = await streamChat(messages, body.model === "deep" ? "deep" : "fast");
    return new Response(stream, { headers: { ...streamHeaders, "X-Coins": ids.join(",") } });
  } catch (e) {
    return Response.json({ error: "AI ตอบไม่สำเร็จ", detail: String((e as Error).message ?? e) }, { status: 502 });
  }
}
