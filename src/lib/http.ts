import "server-only";

/* ---------- แคชในหน่วยความจำ: ลดการยิง API ซ้ำ และยังมีข้อมูลเก่าใช้ถ้า API ล่ม ---------- */
type Entry = { at: number; value: unknown };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      if (hit) return hit.value as T; // ใช้ข้อมูลเก่าดีกว่าไม่มีอะไรเลย
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function getJSON<T>(url: string, timeoutMs = 9000): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

/** รันงานพร้อมกันไม่เกิน n งาน (กันโดนกระดานจำกัดความถี่) */
export async function mapLimit<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
