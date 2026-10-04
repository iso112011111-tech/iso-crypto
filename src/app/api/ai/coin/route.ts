import { COIN_TASK, SYSTEM_PROMPT, compactCoin, getCachedAnalysis, marketContext, parseVerdict, saveCall, scoreStats, setCachedAnalysis, streamChat, consumeQuota, MODELS, type ModelKey } from "@/lib/ai";
import { aiGuard, streamHeaders } from "@/lib/aiGuard";
import { getCoinBundle } from "@/lib/coinBundle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** AI วิเคราะห์เหรียญเดียวเชิงลึก (สตรีมข้อความ) แล้วบันทึกคำตัดสินไว้ตรวจผลย้อนหลัง */
export async function POST(req: Request) {
  const guard = await aiGuard(req);
  if (guard instanceof Response) return guard;
  const { id, model } = (await req.json().catch(() => ({}))) as { id?: string; model?: ModelKey };
  if (!id) return Response.json({ error: "ไม่ได้ระบุเหรียญ" }, { status: 400 });
  const m: ModelKey = model === "fast" ? "fast" : "deep";

  try {
    const coin = await getCoinBundle(id);
    const snap = {
      price: coin.dex?.price ?? coin.market?.price ?? coin.analysis?.price ?? 0,
      score: coin.analysis?.score ?? null,
      tone: coin.analysis?.verdict.tone ?? null,
    };
    // ผลวิเคราะห์ล่าสุดยังใช้ได้ (ไม่เกิน 2 ชม. และตลาดยังไม่เปลี่ยนมาก) → ส่งของเดิม ไม่เสียเครดิต
    const hit = await getCachedAnalysis(id, m, snap);
    if (hit) return new Response(hit.text, { headers: { ...streamHeaders, "X-Cached-At": String(hit.at) } });

    const left = await consumeQuota(guard.uid, "coin");
    if (left < 0) return Response.json({ error: "ใช้ AI วิเคราะห์เชิงลึกครบโควตาวันนี้แล้ว (15 ครั้ง/วัน) — พรุ่งนี้ใช้ได้ใหม่" }, { status: 429 });

    const [market, stats] = await Promise.all([marketContext(), scoreStats()]);
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
    const price = snap.price;
    const tapped = stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          full += decoder.decode(chunk, { stream: true });
          ctrl.enqueue(chunk);
        },
        async flush() {
          const v = parseVerdict(full);
          if (full.trim().length > 200) await setCachedAnalysis(id, m, full, snap).catch(() => {});
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
    return new Response(tapped, { headers: { ...streamHeaders, "X-Quota-Left": String(left) } });
  } catch (e) {
    return Response.json({ error: "AI วิเคราะห์ไม่สำเร็จ", detail: String((e as Error).message ?? e) }, { status: 502 });
  }
}
