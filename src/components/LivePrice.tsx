"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTHB } from "@/lib/format";

/** ราคาที่กะพริบเขียว/แดงทุกครั้งที่ขยับ */
export default function LivePrice({ value, className = "" }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; key: number } | null>(null);

  useEffect(() => {
    if (value !== prev.current) {
      const dir = value > prev.current ? "up" : "down";
      prev.current = value;
      // ตั้งค่าใน callback ของเฟรมถัดไป เพื่อเริ่มแอนิเมชันใหม่ทุกครั้ง
      const id = requestAnimationFrame(() => setFlash({ dir, key: Date.now() }));
      return () => cancelAnimationFrame(id);
    }
  }, [value]);

  return (
    <span key={flash?.key} className={`num rounded px-1 ${flash ? (flash.dir === "up" ? "flash-up" : "flash-down") : ""} ${className}`}>
      {fmtTHB(value)}
    </span>
  );
}
