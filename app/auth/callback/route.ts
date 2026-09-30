import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * สร้างหรืออัปเดตแถวเริ่มต้นใน public.profiles หากยังไม่มีข้อมูลของผู้ใช้นี้
 * - มีการตรวจสอบ fallback ของชื่อและรูปภาพอย่างครอบคลุม
 * - ดักจับ error พร้อมแสดงผล log เพื่อช่วยตรวจสอบปัญหา
 * - ครอบ try-catch เพื่อป้องกันไม่ให้ข้อผิดพลาดของฐานข้อมูลทำให้ขั้นตอน Redirect สะดุด
 */
async function ensureProfileExists(supabase: SupabaseClient, user: User) {
  try {
    // 1. ตรวจสอบว่ามีโปรไฟล์ในตาราง public.profiles อยู่แล้วหรือไม่
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn(
        "แจ้งเตือน: ไม่สามารถตรวจสอบข้อมูลโปรไฟล์เดิมได้:",
        fetchError.message,
      );
    }

    // หากมีข้อมูลโปรไฟล์อยู่แล้ว ไม่จำเป็นต้อง insert ซ้ำ
    if (existingProfile) {
      return;
    }

    // 2. ดึงข้อมูล User Metadata จาก OAuth Provider (Google)
    const metadata = user.user_metadata ?? {};

    // 3. จัดการ Fallback ของชื่อผู้ใช้ (full_name) อย่างรัดกุม:
    // ลำดับ: full_name -> name -> user_name -> ชื่อหน้าอีเมล -> ค่าเริ่มต้น
    const emailPrefix = user.email ? user.email.split("@")[0] : "";
    const candidateName =
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      emailPrefix ||
      "ผู้ใช้ Care Companion";

    const fullName =
      typeof candidateName === "string" && candidateName.trim()
        ? candidateName.trim()
        : "ผู้ใช้ Care Companion";

    // 4. จัดการ Fallback ของรูปโปรไฟล์ (avatar_url):
    // ลำดับ: avatar_url -> picture -> null
    const candidateAvatar = metadata.avatar_url || metadata.picture || null;
    const avatarUrl =
      typeof candidateAvatar === "string" && candidateAvatar.trim()
        ? candidateAvatar.trim()
        : null;

    // 5. บันทึกข้อมูลโปรไฟล์เริ่มต้นลง public.profiles
    // ใช้ upsert เพื่อป้องกัน race condition กรณีที่มีการเรียก callback ซ้ำซ้อน
    const { error: insertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: "customer",
      },
      // ถ้ามีแถวอยู่แล้วให้ข้าม (ON CONFLICT DO NOTHING) เพราะผู้ใช้ทั่วไปไม่มีสิทธิ์ UPDATE คอลัมน์ role
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (insertError) {
      console.error(
        "เกิดข้อผิดพลาดในการบันทึกข้อมูล public.profiles:",
        insertError.message,
        insertError.details ?? "",
      );
    }
  } catch (err) {
    // ดักจับ error ไม่คาดคิด เพื่อไม่ให้ขัดขวางการ Redirect ของผู้ใช้
    console.error("เกิดข้อผิดพลาดไม่คาดคิดใน ensureProfileExists:", err);
  }
}

/**
 * เลือก URL สำหรับ Redirect หลังยืนยันตัวตนสำเร็จ
 * - Local Environment: ใช้ origin ของเบราว์เซอร์
 * - Production: ตรวจสอบ header x-forwarded-host ป้องกันปัญหาโดเมนหลัง Reverse Proxy
 */
function getRedirectUrl(request: Request, origin: string, next: string): string {
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
 * Route Handler สำหรับรับ Redirect จาก OAuth Provider (Google)
 * 1. ตรวจสอบ error parameter จาก OAuth Provider
 * 2. แลกเปลี่ยน authorization code เป็น Auth Session (แลก Cookie)
 * 3. บันทึกโปรไฟล์เริ่มต้นลง public.profiles พร้อม log และ fallback ที่ปลอดภัย
 * 4. นำทางผู้ใช้ไปยัง URL ปลายทางที่ต้องการ
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const authErrorDescription = searchParams.get("error_description");

  // ถ้า OAuth Provider ส่ง error กลับมา (เช่น ผู้ใช้กดยกเลิกการล็อกอิน) ให้ log และ redirect กลับหน้าแรก
  if (authError) {
    console.error(
      "OAuth Provider ส่งข้อผิดพลาดกลับมา:",
      authError,
      authErrorDescription ?? "",
    );
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(authError)}`,
    );
  }

  // ป้องกันช่องโหว่ Open Redirect: ตรวจสอบว่า next ต้องขึ้นต้นด้วย '/' และไม่ใช่ '//'
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/";
  }

  // หากได้รับ code ให้ทำการแลกเป็น Auth Session
  if (code) {
    const supabase = await createClient();

    // แลก Authorization Code เป็น Session ของผู้ใช้
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        "เกิดข้อผิดพลาดในการแลก Code เป็น Session (exchangeCodeForSession):",
        exchangeError.message,
      );
      return NextResponse.redirect(`${origin}/?error=auth_exchange_failed`);
    }

    // ดึงข้อมูล User ปัจจุบันเพื่อนำไปสร้างโปรไฟล์
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError) {
      console.error(
        "เกิดข้อผิดพลาดในการดึงข้อมูล User หลังแลก Session:",
        getUserError.message,
      );
    }

    if (user) {
      // ตรวจสอบและสร้างโปรไฟล์เริ่มต้นลงตาราง public.profiles
      await ensureProfileExists(supabase, user);
    }

    // เมื่อสร้าง session และโปรไฟล์เรียบร้อย ให้ redirect ไปยังปลายทาง
    return NextResponse.redirect(getRedirectUrl(request, origin, next));
  }

  // หากไม่มี code ส่งมา ให้ส่งกลับหน้าแรก
  console.warn("ไม่พบ Authorization Code ในคำขอ callback");
  return NextResponse.redirect(`${origin}/`);
}
