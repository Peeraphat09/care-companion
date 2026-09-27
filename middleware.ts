import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Middleware ที่ Root ของโปรเจกต์
 * เรียก updateSession เพื่อรีเฟรช Auth Session ก่อนเข้าสู่ทุกหน้าเว็บ
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// กรองเฉพาะ Route หน้าเว็บ ยกเว้นไฟล์ static, รูปภาพ และ favicon
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
