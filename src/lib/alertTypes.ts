/** กฎแจ้งเตือน (ใช้ร่วมกันทั้งฝั่งเว็บและเซิร์ฟเวอร์) */
export type AlertKind = "above" | "below" | "move" | "score";

export type AlertRule = {
  id: string;
  assetId: string; // "BTC" หรือ "dex:<chain>:<address>"
  symbol: string;
  kind: AlertKind;
  value: number; // ราคาบาท / % การขยับ / คะแนน
  once: boolean; // เตือนครั้งเดียวแล้วปิด
  active: boolean;
  note?: string;
  source?: string; // เช่น "journal:<id>" ถ้าสร้างจากสมุดเทรด
  createdAt: number;
};

export const KIND_TH: Record<AlertKind, string> = {
  above: "ราคาขึ้นถึง",
  below: "ราคาลงถึง",
  move: "ขยับแรงใน 24 ชม. เกิน",
  score: "Setup Score ถึง",
};
