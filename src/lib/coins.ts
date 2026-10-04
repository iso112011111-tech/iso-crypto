/** ชื่อเรียกภาษาไทยของเหรียญยอดนิยม (เหรียญอื่นแสดงชื่อภาษาอังกฤษ) */
export const THAI_NAMES: Record<string, string> = {
  BTC: "บิตคอยน์",
  ETH: "อีเธอเรียม",
  SOL: "โซลานา",
  BNB: "บีเอ็นบี",
  XRP: "ริปเปิล",
  DOGE: "ด็อกคอยน์",
  ADA: "คาร์ดาโน",
  TRX: "ทรอน",
  LINK: "เชนลิงก์",
  AVAX: "อวาแลนช์",
  SUI: "ซุย",
  TON: "ทอนคอยน์",
  NEAR: "เนียร์",
  DOT: "โพลคาด็อต",
  INJ: "อินเจคทีฟ",
  RENDER: "เรนเดอร์",
  ARB: "อาร์บิทรัม",
  PEPE: "เปเป้",
  SHIB: "ชิบะ",
  LTC: "ไลต์คอยน์",
  BCH: "บิตคอยน์แคช",
  KUB: "คับ (Bitkub Chain)",
  UNI: "ยูนิสวอป",
  APT: "แอปทอส",
  OP: "ออปติมิซึม",
  POL: "โพลิกอน",
  XLM: "สเตลลาร์",
  HBAR: "เฮเดรา",
};

/** เหรียญที่ราคาตรึง 1 ดอลลาร์/สกุลเงิน — ไม่มีประโยชน์ในการวิเคราะห์ */
export const STABLECOINS = new Set([
  "USDT", "USDC", "FDUSD", "TUSD", "DAI", "USDE", "USDD", "PYUSD", "BUSD", "USDP", "USD1", "RLUSD", "USDS",
  "EUR", "EURI", "EURC", "AEUR", "TRY", "BRL", "GBP", "JPY", "USDQ", "USDR", "GUSD", "FRAX", "LUSD", "UST",
  "USTC", "XUSD", "USDJ", "USDX", "BFUSD", "USDF", "USDG", "PAXG", "XAUT",
]);

/** โทเคนเลเวอเรจ (เช่น BTC3L, ETH5S) และสัญลักษณ์แปลก ๆ */
export const isJunkSymbol = (s: string) =>
  STABLECOINS.has(s) || /^[A-Z0-9]+[2-5][LS]$/.test(s) || !/^[A-Z0-9]{1,15}$/.test(s);
