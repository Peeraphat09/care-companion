import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ดักจับ Request เพื่อรีเฟรช Auth Session
 * เรียก supabase.auth.getUser() เพื่อให้ Token ที่หมดอายุถูกต่ออายุและเขียนกลับลง Cookie
 */
export async function updateSession(request: NextRequest) {
  // สร้าง Response เริ่มต้นเพื่อส่งต่อ Request ไปยังหน้าถัดไป
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // อ่าน Cookies จาก Request ที่เข้ามา
        getAll() {
          return request.cookies.getAll();
        },
        // เขียน Cookies ที่อัปเดตแล้วกลับไปทั้ง Request และ Response
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // สำคัญ: ต้องเรียก getUser() ทันทีหลังสร้าง Client
  // เพื่อให้ Session ถูกตรวจสอบและรีเฟรชอย่างถูกต้อง
  await supabase.auth.getUser();

  return supabaseResponse;
}
