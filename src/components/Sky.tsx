"use client";

import { useEffect, useRef } from "react";

/**
 * พื้นหลังท้องฟ้ากลางคืน: ดาวกะพริบ + ดาวตกนาน ๆ ที (canvas) + ดวงจันทร์ + เนินเขา
 * หยุดวาดเมื่อสลับแท็บ และวาดภาพนิ่งถ้าผู้ใช้ตั้งค่าลดการเคลื่อนไหว
 */
export default function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    type Star = { x: number; y: number; r: number; a: number; s: number };
    let stars: Star[] = [];
    let meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextMeteor = performance.now() + 4000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 5200);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() * 1.1 + 0.25,
        a: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 1.4,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduce ? 0.7 : 0.45 + 0.55 * Math.abs(Math.sin(s.a + (t / 1000) * s.s));
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = "#e6e8ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) {
        if (!meteor && t > nextMeteor) {
          meteor = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.3, vx: -7, vy: 3.2, life: 1 };
          nextMeteor = t + 7000 + Math.random() * 9000;
        }
        if (meteor) {
          const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14);
          g.addColorStop(0, `rgba(255,255,255,${meteor.life})`);
          g.addColorStop(1, "rgba(160,150,255,0)");
          ctx.globalAlpha = 1;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(meteor.x, meteor.y);
          ctx.lineTo(meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14);
          ctx.stroke();
          meteor.x += meteor.vx;
          meteor.y += meteor.vy;
          meteor.life -= 0.012;
          if (meteor.life <= 0 || meteor.x < -100) meteor = null;
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <canvas ref={ref} className="absolute inset-0" />
      {/* ดวงจันทร์ */}
      {/* มือถือ: มุมซ้ายบน (เหมือน domeright) · จอใหญ่: มุมขวาบน ไม่ทับเมนู */}
      <div className="float-slow absolute -left-28 -top-28 size-[300px] opacity-45 lg:-right-44 lg:-top-48 lg:left-auto lg:size-[460px] lg:opacity-35">
        <div
          className="size-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 34%, #ffffff 0%, #e9ecf7 30%, #c5cadf 62%, #9aa1bd 100%), radial-gradient(circle, transparent 60%, transparent)",
            boxShadow: "0 0 80px 10px rgb(190 200 255 / 0.18), 0 0 200px 40px rgb(120 130 255 / 0.12)",
          }}
        />
        {[
          [22, 18, 13],
          [46, 34, 17],
          [18, 48, 11],
          [62, 58, 9],
          [36, 68, 12],
          [70, 26, 7],
        ].map(([x, y, s], i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, width: `${s}%`, height: `${s}%`, background: "radial-gradient(circle at 40% 40%, #b8bed6, #a3aac6 60%, #9aa1bd)", boxShadow: "inset 2px 2px 6px rgb(0 0 0 / 0.12)" }}
          />
        ))}
      </div>
      {/* เนินเขา */}
      <svg className="absolute inset-x-0 bottom-0 h-[34vh] w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hill1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#262c66" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0b1030" />
          </linearGradient>
          <linearGradient id="hill2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1a1f4d" />
            <stop offset="1" stopColor="#070b24" />
          </linearGradient>
        </defs>
        <path d="M0 170 C 240 90 420 120 640 150 S 1080 80 1440 140 L1440 320 L0 320Z" fill="url(#hill1)" opacity="0.65" />
        <path d="M0 230 C 300 170 560 250 860 210 S 1260 170 1440 220 L1440 320 L0 320Z" fill="url(#hill2)" />
      </svg>
    </div>
  );
}
