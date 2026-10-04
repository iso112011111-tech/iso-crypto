import { COIN_TASK, SYSTEM_PROMPT, compactCoin, marketContext, parseVerdict, saveCall, scoreStats, streamChat, MODELS, type ModelKey } from "@/lib/ai";
import { aiGuard, streamHeaders } from "@/lib/aiGuard";
import { getCoinBundle } from "@/lib/coinBundle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** AI วิเคราะห์เหรียญเดียวเชิงลึก (สตรีมข้อความ) แล้วบันทึกคำตัดสินไว้ตรวจผลย้อนหลัง */
export async function POST(req: Request) {
  const blocked = await aiGuard(req);
  if (blocked) return blocked;
  const { id, model } = (await req.json().catch(() => ({}))) as { id?: string; model?: ModelKey };
  if (!id) return Response.json({ error: "ไม่ได้ระบุเหรียญ" }, { status: 400 });
  const m: ModelKey = model === "fast" ? "fast" : "deep";

  try {
    const [coin, market, stats] = await Promise.all([getCoinBundle(id), marketContext(), scoreStats()]);
    const data = { coin: compactCoin(coin), market, scoreStats: stats };
    const stream = await streamChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `<data>\n${JSON.stringify(data)}\n</data>\n\n${COIN_TASK}` },
      ],
      m,
    );

    // เก็บข้อความทั้งหมดระหว่างสตรีม พอจบแล้วอ่านคำตัดสินไปบันทึก
    let full = "";
    const decoder = new TextDecoder();
    const price = coin.dex?.price ?? coin.market?.price ?? coin.analysis?.price ?? 0;
    const tapped = stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          full += decoder.decode(chunk, { stream: true });
          ctrl.enqueue(chunk);
        },
        async flush() {
          const v = parseVerdict(full);
          if (v && price > 0)
            await saveCall({
              id: crypto.randomUUID(),
              assetId: coin.id,
              symbol: data.coin.symbol,
              ...v,
              price,
              score: coin.analysis?.score ?? null,
              at: Date.now(),
              model: MODELS[m],
            }).catch(() => {});
        },
      }),
    );
    return new Response(tapped, { headers: streamHeaders });
  } catch (e) {
    return Response.json({ error: "AI วิเคราะห์ไม่สำเร็จ", detail: String((e as Error).message ?? e) }, { status: 502 });
  }
}
