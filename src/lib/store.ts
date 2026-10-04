import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * ที่เก็บข้อมูลแบบ key → JSON
 * - ตั้ง UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → ใช้ Upstash Redis (สำหรับ deploy บน Vercel)
 * - ไม่ตั้ง → เก็บในไฟล์ .data/db.json (สำหรับรันในเครื่อง/เซิร์ฟเวอร์ของตัวเอง)
 */
export interface Store {
  kind: "redis" | "file";
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

function redisStore(url: string, token: string): Store {
  const call = async (cmd: unknown[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis ${res.status}`);
    return ((await res.json()) as { result: unknown }).result;
  };
  return {
    kind: "redis",
    async get<T>(key: string) {
      const v = await call(["GET", key]);
      return typeof v === "string" ? (JSON.parse(v) as T) : null;
    },
    async set(key, value) {
      await call(["SET", key, JSON.stringify(value)]);
    },
  };
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function fileStore(): Store {
  // อ่านไฟล์ใหม่ทุกครั้ง (อิง mtime) เพราะตัวตั้งเวลาเบื้องหลังกับ API อาจเป็นคนละอินสแตนซ์ ห้ามถือข้อมูลเก่าไว้แล้วเขียนทับ
  let cache: { mtime: number; db: Record<string, unknown> } | null = null;
  let queue = Promise.resolve();

  const load = async (): Promise<Record<string, unknown>> => {
    try {
      const st = await fs.stat(DB_FILE);
      if (cache && cache.mtime === st.mtimeMs) return cache.db;
      const db = JSON.parse(await fs.readFile(DB_FILE, "utf8"));
      cache = { mtime: st.mtimeMs, db };
      return db;
    } catch {
      return {};
    }
  };

  return {
    kind: "file",
    async get<T>(key: string) {
      const db = await load();
      return (db[key] as T) ?? null;
    },
    set(key, value) {
      // เขียนทีละครั้ง: อ่านล่าสุด → แก้ → ไฟล์ชั่วคราว → rename กันไฟล์พัง
      queue = queue.then(async () => {
        const db = { ...(await load()), [key]: value };
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(db));
        await fs.rename(tmp, DB_FILE);
        cache = null;
      });
      return queue;
    },
  };
}

let instance: Store | null = null;

export function getStore(): Store {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  instance = url && token ? redisStore(url, token) : fileStore();
  return instance;
}
