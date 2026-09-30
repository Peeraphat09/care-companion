import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * สร้าง Supabase Client สำหรับฝั่ง Server
 * (Server Component, Server Action และ Route Handler)
 * จัดการ Cookies ผ่าน next/headers ทั้งการอ่าน (getAll) และการเขียน (setAll)
 */
export async function createClient() {
  // อ่าน Cookie Store ของ Request ปัจจุบัน
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // อ่าน Cookies ทั้งหมดที่เบราว์เซอร์ส่งมา
        getAll() {
          return cookieStore.getAll();
        },
        // เขียน Cookies กลับเมื่อมีการรีเฟรช Session
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ถ้าเรียกจาก Server Component จะเขียน Cookie ไม่ได้
            // สามารถละเว้นได้ เพราะ middleware จะรีเฟรช Session ให้แทน
          }
        },
      },
    },
  );
}

/**
 * สร้าง Supabase Client สำหรับฝั่ง Server แบบใช้ Service Role Key
 * เพื่อสิทธิพิเศษในการจัดการฐานข้อมูลโดยข้ามกฎ RLS (เฉพาะแอดมิน)
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
