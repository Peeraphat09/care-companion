import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Care Companion",
  description:
    "แพลตฟอร์มเชื่อมผู้ที่ต้องการผู้ช่วยร่วมเดินทางกับผู้ช่วยร่วมเดินทาง",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-800">
        {/* แถบนำทางแสดงทุกหน้า */}
        <Navbar />
        {children}
      </body>
    </html>
  );
}
