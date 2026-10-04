/**
 * ตัวตั้งเวลาเบื้องหลังสำหรับรันในเครื่อง/เซิร์ฟเวอร์ของตัวเอง:
 * เรียก /api/cron ทุก 1 นาที (ตรวจแจ้งเตือน + จับเหรียญใหม่)
 * บน Vercel ไม่ทำงาน (serverless) ให้ใช้ cron ภายนอกแทน — ดู README
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL || !process.env.CRON_SECRET) return;
  const port = process.env.PORT ?? process.env.LOCAL_PORT ?? "3000"; // ตั้ง LOCAL_PORT ถ้ารันพอร์ตอื่น
  const tick = () =>
    // ส่งรหัสทาง header ไม่ให้ไปโผล่ใน log ของเซิร์ฟเวอร์
    fetch(`http://127.0.0.1:${port}/api/cron`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch(() => {
      /* เซิร์ฟเวอร์ยังไม่พร้อม รอบหน้าค่อยลองใหม่ */
    });
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000);
}
