// service worker: ให้ติดตั้งเป็นแอปได้ + รับแจ้งเตือน (ไม่แคชข้อมูลราคา เพราะต้องสดเสมอ)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = { title: "iso-crypto", body: "", url: "/" };
  try {
    d = { ...d, ...e.data.json() };
  } catch {
    if (e.data) d.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/pwa-icon?s=192",
      badge: "/pwa-icon?s=192",
      tag: d.tag,
      renotify: !!d.tag,
      data: { url: d.url },
    }),
  );
});

// แตะแจ้งเตือน → เปิดหน้าเหรียญนั้น (ใช้แท็บเดิมถ้าเปิดอยู่)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});
