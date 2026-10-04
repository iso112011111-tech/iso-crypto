import { getUserAlerts, pushConfigured, setRules } from "@/lib/alerts";
import type { AlertRule } from "@/lib/alertTypes";
import { verifyFirebaseToken } from "@/lib/firebaseVerify";

export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "เข้าสู่ระบบก่อนใช้การแจ้งเตือน" }, { status: 401 });

export async function GET(req: Request) {
  const user = await verifyFirebaseToken(req);
  if (!user) return unauthorized();
  const a = await getUserAlerts(user.uid);
  return Response.json({ rules: a.rules, fired: a.fired, devices: a.subs.length, configured: pushConfigured() });
}

export async function PUT(req: Request) {
  const user = await verifyFirebaseToken(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { rules?: AlertRule[] };
  const KINDS = ["above", "below", "move", "score"];
  const rules = (body.rules ?? [])
    .filter((r) => r && typeof r.id === "string" && typeof r.assetId === "string" && KINDS.includes(r.kind) && Number.isFinite(r.value))
    .map((r) => ({
      id: r.id.slice(0, 64),
      assetId: r.assetId.slice(0, 120),
      symbol: String(r.symbol ?? "").slice(0, 20),
      kind: r.kind,
      value: +r.value,
      once: !!r.once,
      active: r.active !== false,
      note: r.note ? String(r.note).slice(0, 80) : undefined,
      source: r.source ? String(r.source).slice(0, 80) : undefined,
      createdAt: +r.createdAt || Date.now(),
    }));
  await setRules(user.uid, rules);
  return Response.json({ ok: true, count: rules.length });
}
