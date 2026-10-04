// service worker ขั้นต่ำ ให้เบราว์เซอร์ยอมให้ติดตั้งเป็นแอป — ไม่แคชข้อมูลราคา (ต้องสดเสมอ)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
