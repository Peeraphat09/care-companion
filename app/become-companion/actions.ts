"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/utils/supabase/server";

/**
 * ฟังก์ชันช่วยดึงค่าข้อความจาก FormData และตัดช่องว่างหน้าหลัง
 */
function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action สำหรับลงทะเบียนเป็นผู้ช่วยร่วมเดินทาง (Companion)
 * 1. ตรวจสอบสถานะการเข้าสู่ระบบ
 * 2. ตรวจสอบความครบถ้วนของข้อมูล
 * 3. บันทึกหรืออัปเดตข้อมูลลงตาราง public.companion_profiles
 * 4. อัปเดตสิทธิ์ (role) ในตาราง public.profiles ให้เป็น 'companion'
 * 5. รีเฟรช Cache ของระบบ และส่งกลับหน้าแรกพร้อมแจ้งสถานะสำเร็จ
 */
export async function registerAsCompanion(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // ดึงค่าข้อมูลจากแบบฟอร์ม
  const bio = getTextField(formData, "bio");
  const skills = getTextField(formData, "skills");
  const serviceAreas = getTextField(formData, "service_areas");
  const availableDays = getTextField(formData, "available_days");

  // ตรวจสอบว่ากรอกข้อมูลครบทุกช่องหรือไม่
  if (!bio || !skills || !serviceAreas || !availableDays) {
    redirect("/become-companion?error=incomplete");
  }

  // ตรวจสอบก่อนว่ามี Profile อยู่จริง และเป็น customer เท่านั้น (กัน admin/companion ถูกเขียนทับ role)
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) {
    console.error("ไม่พบโปรไฟล์ผู้ใช้");
    redirect("/become-companion?error=profile_not_found");
  }
  if (profile.role !== "customer") {
    redirect("/");
  }

  // บันทึกหรืออัปเดตข้อมูลลงในตาราง companion_profiles
  const { error: companionError } = await supabase
    .from("companion_profiles")
    .upsert({
      id: user.id,
      bio,
      skills,
      service_areas: serviceAreas,
      available_days: availableDays,
      is_available: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (companionError) {
    console.error("เกิดข้อผิดพลาดในการบันทึก companion_profiles:", companionError.message);
    redirect("/become-companion?error=save");
  }

  // อัปเดตสิทธิ์ (role) ให้เป็น 'companion' ผ่าน Admin Client เพราะผู้ใช้ทั่วไปต้องแก้ role ตัวเองไม่ได้
  // (ตรวจแล้วข้างบนว่าเป็น customer และตั้งได้เฉพาะค่า 'companion' เท่านั้น)
  const { error: profileError } = await createAdminClient()
    .from("profiles")
    .update({ role: "companion" })
    .eq("id", user.id);

  if (profileError) {
    console.error("เกิดข้อผิดพลาดในการอัปเดต role ใน profiles:", profileError.message);
    redirect("/become-companion?error=role");
  }

  // ล้าง Cache ของระบบเพื่อให้ Navbar และหน้าระบบอัปเดต Role ทันที
  revalidatePath("/", "layout");

  // ส่งกลับไปยังหน้าแรกพร้อม query param แจ้งความสำเร็จ
  redirect("/?companion=success");
}
