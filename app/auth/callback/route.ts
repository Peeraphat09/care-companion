import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * สร้างแถวเริ่มต้นใน public.profiles หากยังไม่มีข้อมูลของผู้ใช้นี้
 */
async function ensureProfileExists(supabase: SupabaseClient, user: User) {
  // ตรวจสอบว่ามีโปรไฟล์ในตาราง public.profiles แล้วหรือยัง
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return;
  }

  const metadata = user.user_metadata ?? {};

  // หากเป็นผู้ใช้ใหม่ ให้บันทึกข้อมูลเริ่มต้นลง profiles
  await supabase.from("profiles").insert({
    id: user.id,
    // ชื่อจาก Google อาจอยู่ใน full_name หรือ name
    full_name: metadata.full_name || metadata.name || "ผู้ใช้ Care Companion",
    // รูปโปรไฟล์จาก Google อาจอยู่ใน avatar_url หรือ picture
    avatar_url: metadata.avatar_url || metadata.picture || null,
    role: "customer",
  });
}

/**
 * เลือก URL สำหรับ Redirect หลังล็อกอินสำเร็จ
 * ใช้ origin ในเครื่อง และ x-forwarded-host เมื่ออยู่บนเซิร์ฟเวอร์จริง
 */
function getRedirectUrl(request: Request, origin: string, next: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return `${origin}${next}`;
  }

  if (forwardedHost) {
    return `https://${forwardedHost}${next}`;
  }

  return `${origin}${next}`;
}

/**
 * Route Handler สำหรับรับ Redirect หลังล็อกอินด้วย Google OAuth
 * แลก code เป็น Session แล้วสร้างแถวใน public.profiles หากเป็นผู้ใช้ใหม่
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // ถ้ามี param next ให้ใช้เป็นปลายทาง Redirect (ต้องเป็น path ในเว็บเท่านั้น)
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    next = "/";
  }

  if (code) {
    const supabase = await createClient();

    // นำ Authorization Code ไปแลกเป็น Auth Session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await ensureProfileExists(supabase, user);
      }

      return NextResponse.redirect(getRedirectUrl(request, origin, next));
    }
  }

  // หากไม่มี code หรือแลก Session ไม่สำเร็จ ให้กลับหน้าแรก
  return NextResponse.redirect(`${origin}/`);
}
