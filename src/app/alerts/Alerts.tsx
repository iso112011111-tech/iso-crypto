"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { enablePush, pushState, testPush, useAlerts, type PushState } from "@/hooks/alerts";
import { useCoin } from "@/hooks/data";
import { useUser } from "@/hooks/user";
import CoinPicker from "@/components/CoinPicker";
import { Card, Disclaimer, Notice, PageTitle, btn } from "@/components/ui";
import { KIND_TH, type AlertKind, type AlertRule } from "@/lib/alertTypes";
import { fmtTHB } from "@/lib/format";

const newId = () => crypto.randomUUID();

/** สถานะสิทธิ์แจ้งเตือนของเบราว์เซอร์ (อ่านตอนเรนเดอร์ฝั่งเบราว์เซอร์เท่านั้น) */
function usePushState(tick: number): PushState {
  return useSyncExternalStore(
    () => () => {},
    () => (tick >= 0 ? pushState() : "default"),
    () => "default",
  );
}

function AddForm({ initialId, onAdd }: { initialId: string; onAdd: (r: AlertRule) => void }) {
  const [id, setId] = useState(initialId);
  const [kind, setKind] = useState<AlertKind>("above");
  const [value, setValue] = useState("");
  const [once, setOnce] = useState(true);
  const [note, setNote] = useState("");
  const coin = useCoin(id);
  const price = coin.data?.dex?.price ?? coin.data?.market?.price ?? coin.data?.analysis?.price;
  const symbol = coin.data?.dex?.symbol ?? coin.data?.market?.symbol ?? id;

  const suggestions =
    kind === "above"
      ? coin.data?.analysis?.resistances.slice(0, 2)
      : kind === "below"
        ? coin.data?.analysis?.supports.slice(0, 2)
        : kind === "move"
          ? [5, 10, 20]
          : [60, 75];

  const submit = () => {
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) return;
    onAdd({ id: newId(), assetId: coin.data?.id ?? id, symbol, kind, value: v, once, active: true, note: note || undefined, createdAt: Date.now() });
    setValue("");
    setNote("");
  };

  const input = "w-full rounded-xl border border-line bg-[#0b1030]/60 px-3 py-2 text-sm outline-none placeholder:text-dim focus:border-accent/60";
  return (
    <Card title="ตั้งแจ้งเตือนใหม่">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs text-dim">เหรียญ</span>
          <div className="mt-1">
            <CoinPicker value={id} onChange={setId} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-dim">เงื่อนไข</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AlertKind)} className={`${input} mt-1`}>
            {(Object.keys(KIND_TH) as AlertKind[]).filter((k) => k !== "score" || !id.startsWith("dex:")).map((k) => (
              <option key={k} value={k}>
                {KIND_TH[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-dim">{kind === "move" ? "% การขยับ" : kind === "score" ? "คะแนน" : "ราคา (บาท)"}</span>
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "above" || kind === "below" ? (price ? `ตอนนี้ ${fmtTHB(price)}` : "") : ""} className={`num ${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs text-dim">โน้ต (ไม่บังคับ)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ถึงแนวรับ เตรียมเข้าไม้ 2" className={`${input} mt-1`} />
        </label>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-dim">แนะนำ:</span>
          {suggestions.map((s) => (
            <button key={s} onClick={() => setValue(String(kind === "above" || kind === "below" ? +s.toPrecision(6) : s))} className="num rounded-lg border border-line px-2 py-0.5 text-muted hover:border-accent/50 hover:text-fg">
              {kind === "above" || kind === "below" ? fmtTHB(s) : kind === "move" ? `±${s}%` : `≥${s}`}
            </button>
          ))}
          {(kind === "above" || kind === "below") && <span className="text-dim">({kind === "above" ? "แนวต้าน" : "แนวรับ"}จากกราฟ)</span>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button onClick={submit} className={btn.primary}>
          เพิ่มแจ้งเตือน
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="size-4 accent-[#8b7cff]" />
          เตือนครั้งเดียวแล้วปิด
        </label>
        <span className="text-[11px] text-dim">ไม่ติ๊ก = เตือนซ้ำได้ทุก 6 ชม. ตราบที่ยังเข้าเงื่อนไข</span>
      </div>
    </Card>
  );
}

export default function Alerts({ addId }: { addId: string | null }) {
  const user = useUser();
  const alerts = useAlerts();
  const [tick, setTick] = useState(0);
  const perm = usePushState(tick);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (user.ready && !user.user)
    return (
      <main className="max-w-2xl">
        <PageTitle title="แจ้งเตือนเข้ามือถือ" sub="ราคาแตะจุดที่ตั้งไว้ SL/TP ถึง หรือเหรียญมีจังหวะดี ระบบเตือนเข้ามือถือทันที ไม่ต้องเฝ้าจอ" />
        <Card>
          <p className="mb-4 text-sm text-muted">ต้องเข้าสู่ระบบก่อน เพื่อให้ระบบรู้ว่าจะส่งแจ้งเตือนไปที่เครื่องของใคร</p>
          <Link href="/login?next=/alerts" className={btn.primary}>
            เข้าสู่ระบบ
          </Link>
        </Card>
      </main>
    );

  const add = (r: AlertRule) => alerts.save([r, ...alerts.rules]);
  const toggle = (id: string) => alerts.save(alerts.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  const remove = (id: string) => alerts.save(alerts.rules.filter((r) => r.id !== id));

  /** สร้างแจ้งเตือน SL/TP จากเทรดที่ยังถืออยู่ในสมุด (แทนที่ชุดเดิมที่มาจากสมุด) */
  const syncJournal = () => {
    const open = user.data.journal.filter((e) => e.exit == null);
    const fromJournal: AlertRule[] = open.flatMap((e) => [
      ...(e.sl ? [{ id: newId(), assetId: e.assetId, symbol: e.symbol, kind: "below" as const, value: e.sl, once: true, active: true, note: "ถึงจุดตัดขาดทุน (SL)", source: `journal:${e.id}`, createdAt: Date.now() }] : []),
      ...(e.tp ? [{ id: newId(), assetId: e.assetId, symbol: e.symbol, kind: "above" as const, value: e.tp, once: true, active: true, note: "ถึงเป้ากำไร (TP)", source: `journal:${e.id}`, createdAt: Date.now() }] : []),
    ]);
    alerts.save([...fromJournal, ...alerts.rules.filter((r) => !r.source?.startsWith("journal:"))]);
    setMsg({ ok: true, text: `สร้างแจ้งเตือน SL/TP จาก ${open.length} เทรดที่ถืออยู่แล้ว` });
  };

  /** แจ้งเตือนเมื่อเหรียญในรายการโปรดได้คะแนน 75+ */
  const watchScores = () => {
    const ids = user.data.watchlist.filter((x) => !x.startsWith("dex:"));
    const exist = new Set(alerts.rules.filter((r) => r.kind === "score").map((r) => r.assetId));
    const fresh: AlertRule[] = ids.filter((x) => !exist.has(x)).map((x) => ({ id: newId(), assetId: x, symbol: x, kind: "score", value: 75, once: false, active: true, note: "จังหวะน่าสะสม", createdAt: Date.now() }));
    alerts.save([...fresh, ...alerts.rules]);
    setMsg({ ok: true, text: fresh.length ? `เพิ่มแจ้งเตือนคะแนน 75+ ให้ ${fresh.length} เหรียญในรายการโปรด` : "เหรียญในรายการโปรดมีแจ้งเตือนคะแนนครบแล้ว (หรือยังไม่มีรายการโปรด)" });
  };

  const enable = async () => {
    const err = await enablePush();
    setTick((t) => t + 1);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "เปิดแจ้งเตือนบนเครื่องนี้แล้ว ลองกด “ส่งทดสอบ”" });
    alerts.reload();
  };

  const test = async () => {
    try {
      const n = await testPush();
      setMsg(n ? { ok: true, text: `ส่งทดสอบไป ${n} อุปกรณ์แล้ว` } : { ok: false, text: "ยังไม่มีอุปกรณ์ที่เปิดรับแจ้งเตือน" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const describe = (r: AlertRule) =>
    r.kind === "above" || r.kind === "below" ? `${KIND_TH[r.kind]} ${fmtTHB(r.value)}` : r.kind === "move" ? `${KIND_TH.move} ±${r.value}%` : `${KIND_TH.score} ${r.value}`;

  return (
    <main>
      <PageTitle title={<>แจ้งเตือน<span className="text-gradient">เข้ามือถือ</span></>} sub="ระบบตรวจทุก 1 นาที แล้วเด้งแจ้งเตือนเข้าเครื่องคุณทันที ไม่ต้องเปิดเว็บเฝ้า" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <AddForm initialId={addId ?? "BTC"} onAdd={add} />

          <Card title={`แจ้งเตือนของฉัน (${alerts.rules.length})`}>
            {alerts.error && <p className="mb-3 text-sm text-down">{alerts.error}</p>}
            {alerts.rules.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">{alerts.loading ? "กำลังโหลด…" : "ยังไม่มีแจ้งเตือน"}</p>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.rules.map((r) => (
                  <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${r.active ? "" : "opacity-50"}`}>
                    <Link href={`/coin/${encodeURIComponent(r.assetId)}`} className="w-20 font-medium hover:text-accent-2">
                      {r.symbol}
                    </Link>
                    <div className="min-w-0 flex-1 text-sm">
                      <div>{describe(r)}</div>
                      <div className="text-[11px] text-dim">
                        {r.note ?? (r.once ? "เตือนครั้งเดียว" : "เตือนซ้ำทุก 6 ชม.")}
                        {alerts.fired[r.id] && ` · เตือนล่าสุด ${new Date(alerts.fired[r.id]).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`}
                      </div>
                    </div>
                    <button onClick={() => toggle(r.id)} className={`relative h-6 w-11 rounded-full transition ${r.active ? "bg-accent" : "bg-panel-2"}`} aria-label={r.active ? "ปิด" : "เปิด"}>
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${r.active ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => remove(r.id)} className="text-dim hover:text-down" aria-label="ลบ">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="อุปกรณ์นี้">
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className={`size-2 rounded-full ${perm === "granted" ? "live-dot bg-up" : perm === "denied" ? "bg-down" : "bg-dim"}`} />
              {{ granted: "อนุญาตแจ้งเตือนแล้ว", denied: "ถูกบล็อก — เปิดที่การตั้งค่าเว็บไซต์", default: "ยังไม่ได้เปิด", unsupported: "เบราว์เซอร์นี้ไม่รองรับ" }[perm]}
            </div>
            <p className="mb-3 text-xs text-dim">อุปกรณ์ที่รับแจ้งเตือนในบัญชีนี้: {alerts.devices} เครื่อง</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={enable} className={btn.primary}>
                {perm === "granted" ? "เชื่อมเครื่องนี้อีกครั้ง" : "เปิดแจ้งเตือนบนเครื่องนี้"}
              </button>
              <button onClick={test} className={btn.ghost}>
                ส่งทดสอบ
              </button>
            </div>
            {msg && <p className={`mt-3 text-[13px] ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
          </Card>

          <Card title="ตั้งค่าด่วน">
            <div className="space-y-2">
              <button onClick={syncJournal} className={`${btn.ghost} w-full justify-start`}>
                เตือน SL/TP ของเทรดที่ถืออยู่ ({user.data.journal.filter((e) => e.exit == null).length})
              </button>
              <button onClick={watchScores} className={`${btn.ghost} w-full justify-start`}>
                เตือนเมื่อเหรียญโปรดได้คะแนน 75+ ({user.data.watchlist.filter((x) => !x.startsWith("dex:")).length})
              </button>
            </div>
          </Card>

          <Notice tone="info">
            <b className="text-fg">iPhone:</b> ต้องกดแชร์ → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนแอปก่อน จึงจะเปิดแจ้งเตือนได้ (iOS 16.4+) · <b className="text-fg">Android/คอม:</b> กดเปิดได้เลย
          </Notice>
        </div>
      </div>
      <Disclaimer />
    </main>
  );
}
