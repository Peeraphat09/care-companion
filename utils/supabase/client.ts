import { createBrowserClient } from "@supabase/ssr";

/**
 * สร้าง Supabase Client สำหรับใช้ใน Client Component
 * ใช้ createBrowserClient เพื่ออ่าน/เขียน Session ผ่าน Cookies ฝั่งเบราว์เซอร์
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
