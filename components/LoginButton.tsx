"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * คอมโพเนนต์ปุ่มเข้าสู่ระบบด้วยบัญชี Google (Client Component)
 * ใช้ signInWithOAuth ของ Supabase Auth และส่งผู้ใช้ไปที่ /auth/callback
 */
export default function LoginButton() {
  // สถานะกำลังโหลดเพื่อป้องกันการกดซ้ำขณะรอเปิดหน้า Google
  const [isLoading, setIsLoading] = useState(false);

  // ฟังก์ชันเริ่มต้นการเข้าสู่ระบบด้วย Google OAuth
  async function handleLogin() {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const origin = window.location.origin;

      // เรียก Supabase Auth ให้เด้งไปหน้ายืนยันตัวตนของ Google
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // กำหนด URL ปลายทางหลังล็อกอินผ่าน Google สำเร็จ
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error.message);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("เกิดข้อผิดพลาดไม่คาดคิด:", err);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* แสดงไอคอน Google สีทางการ */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {isLoading ? "กำลังนำท่านเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
    </button>
  );
}
