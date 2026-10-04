import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iso-crypto · วิเคราะห์คริปโตสำหรับคนไทย",
    short_name: "iso-crypto",
    description: "วิเคราะห์ทุกเหรียญจากทุกกระดานและ DEX วางแผนแบ่งไม้ สแกนหาจังหวะ ผู้ช่วย AI เป็นเงินบาท",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b24",
    theme_color: "#0c1238",
    lang: "th",
    icons: [
      { src: "/pwa-icon?s=192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon?s=512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon?s=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
