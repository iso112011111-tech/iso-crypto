/** แสดงราคาบาทแบบอ่านง่าย รองรับเหรียญราคาต่ำมากอย่าง PEPE */
export function fmtTHB(v: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  let digits: Intl.NumberFormatOptions;
  if (abs >= 1000) digits = { maximumFractionDigits: 0 };
  else if (abs >= 1) digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  else if (abs === 0) digits = { maximumFractionDigits: 0 };
  else digits = { maximumSignificantDigits: 4 };
  const s = abs.toLocaleString("th-TH", digits);
  const sign = v < 0 ? "-" : opts.sign && v > 0 ? "+" : "";
  return `${sign}฿${s}`;
}

/** ย่อเลขใหญ่: 1.2 ล้านล้าน, 350 ล้าน */
export function fmtCompactTHB(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e12) return `฿${(v / 1e12).toFixed(2)} ล้านล้าน`;
  if (v >= 1e9) return `฿${(v / 1e9).toFixed(2)} พันล้าน`;
  if (v >= 1e6) return `฿${(v / 1e6).toFixed(2)} ล้าน`;
  return fmtTHB(v);
}

export function fmtPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString("th-TH", { maximumFractionDigits: 4 });
  return v.toLocaleString("th-TH", { maximumSignificantDigits: 6 });
}
