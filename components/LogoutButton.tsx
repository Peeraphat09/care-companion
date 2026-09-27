"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * คอมโพเนนต์ปุ่มออกจากระบบ (Client Component)
 * เรียก supabase.auth.signOut() และพาผู้ใช้กลับสู่หน้าแรก
 */
export default function LogoutButton() {
  const router = useRouter();
  // สถานะกำลังออกจากระบบเพื่อป้องกันการกดซ้ำ
  const [isLoading, setIsLoading] = useState(false);

  // ฟังก์ชันล้าง Session และรีไดเรกต์กลับหน้าแรก
  async function handleLogout() {
    try {
      setIsLoading(true);
      const supabase = createClient();
      await supabase.auth.signOut();

      // นำทางกลับหน้าแรกและรีเฟรชข้อมูล Server Components
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการออกจากระบบ:", err);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {isLoading ? "กำลังออก..." : "ออกจากระบบ"}
    </button>
  );
}
