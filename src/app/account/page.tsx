"use client";

import Link from "next/link";
import { useState } from "react";
import { logout, updateData, useUser } from "@/hooks/user";
import { Card, Notice, PageTitle, Stat, btn } from "@/components/ui";

export default function Account() {
  const user = useUser();
  const [msg, setMsg] = useState<string | null>(null);
  const p = user.user;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(user.data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `iso-crypto-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.portfolio) || !Array.isArray(d.journal)) throw new Error();
      updateData(() => ({ portfolio: d.portfolio, watchlist: Array.isArray(d.watchlist) ? d.watchlist : [], journal: d.journal, updatedAt: Date.now() }));
      setMsg("นำเข้าข้อมูลแล้ว");
    } catch {
      setMsg("ไฟล์ไม่ถูกต้อง");
    }
  };

  return (
    <main className="max-w-3xl">
      <PageTitle title="บัญชีของฉัน" sub="ข้อมูลพอร์ต รายการโปรด และสมุดเทรดของคุณเก็บแยกเป็นส่วนตัวใน Firebase ใช้ได้ทุกเครื่อง" />

      {p ? (
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            {p.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo} alt="" width={56} height={56} referrerPolicy="no-referrer" className="rounded-full ring-2 ring-accent/40" />
            ) : (
              <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#a78bfa] text-xl font-semibold text-white">{p.name[0]?.toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="truncate text-sm text-muted">{p.email}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-dim">
                <span className={`size-1.5 rounded-full ${user.error ? "bg-down" : user.syncing ? "live-dot bg-warn" : "bg-up"}`} />
                {user.error ?? (user.syncing ? "กำลังซิงก์…" : "ซิงก์กับคลาวด์แล้ว")}
              </div>
            </div>
            <button onClick={logout} className={`${btn.ghost} ml-auto`}>
              ออกจากระบบ
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">ยังไม่ได้เข้าสู่ระบบ</div>
              <p className="mt-1 text-sm text-muted">ใช้งานได้ครบโดยไม่ต้องสมัคร แต่ข้อมูลจะอยู่แค่ในเบราว์เซอร์นี้ · เข้าสู่ระบบเพื่อซิงก์ทุกเครื่องและใช้ผู้ช่วย AI</p>
            </div>
            <Link href="/login?next=/account" className={btn.primary}>
              เข้าสู่ระบบ / สมัคร
            </Link>
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="เหรียญในพอร์ต" value={<span className="num">{user.data.portfolio.length}</span>} />
        <Stat label="รายการโปรด" value={<span className="num">{user.data.watchlist.length}</span>} />
        <Stat label="สมุดเทรด" value={<span className="num">{user.data.journal.length}</span>} />
      </div>

      <Card title="สำรองข้อมูล" className="mt-4">
        <p className="mb-4 text-sm text-muted">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ เก็บไว้หรือย้ายไปเครื่องอื่นได้</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className={btn.ghost}>
            ดาวน์โหลดไฟล์สำรอง
          </button>
          <label className={`${btn.ghost} cursor-pointer`}>
            นำเข้าจากไฟล์
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      </Card>

      {!p && (
        <div className="mt-4">
          <Notice tone="info">ล้างประวัติเบราว์เซอร์ = ข้อมูลที่ไม่ได้เข้าสู่ระบบจะหาย</Notice>
        </div>
      )}
    </main>
  );
}
