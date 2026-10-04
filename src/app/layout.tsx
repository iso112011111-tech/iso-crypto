import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "iso-crypto · เครื่องมือวิเคราะห์คริปโตสำหรับคนไทย",
  description: "วิเคราะห์ทุกเหรียญจากทุกกระดานและ DEX วางแผนแบ่งไม้ สแกนหาจังหวะ ทดสอบย้อนหลัง เป็นเงินบาท",
};

export const viewport: Viewport = { themeColor: "#0c1238" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${geistSans.variable} ${geistMono.variable} ${thai.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
