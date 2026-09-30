"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

// ชื่อ Bucket ใน Supabase Storage ที่ใช้เก็บรูปโปรไฟล์
const AVATAR_BUCKET = "companion-files";

// ขนาดไฟล์รูปสูงสุด (2MB) และชนิดไฟล์ที่อนุญาต พร้อมนามสกุลที่ใช้บันทึก (ไม่เชื่อชื่อไฟล์จากผู้ใช้)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * ฟังก์ชันช่วยดึงค่าข้อความจาก FormData และตัดช่องว่างหน้าหลัง
 */
function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action: บันทึกโปรไฟล์ของผู้ใช้ปัจจุบัน (ทุก role)
 * 1. ตรวจสอบการล็อกอิน และอ่าน role จาก DB
 * 2. ตรวจชื่อ (จำเป็น) และเบอร์โทร (ไม่บังคับ แต่ถ้ากรอกต้องเป็นรูปแบบที่ถูกต้อง)
 * 3. ถ้ามีรูปใหม่: ตรวจชนิด/ขนาด แล้วอัปโหลดขึ้น Supabase Storage โฟลเดอร์ของตนเอง
 * 4. อัปเดต public.profiles (full_name, phone, avatar_url) — ไม่แตะคอลัมน์ role
 * 5. ถ้าเป็น Companion: อัปเดต companion_profiles (bio, skills, service_areas, available_days, is_available)
 */
export async function updateProfile(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // อ่านข้อมูลโปรไฟล์ปัจจุบัน (ใช้ role และรูปเดิม ไม่เชื่อค่าจากฟอร์ม)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/profile?error=profile_not_found");
  }

  // ตรวจชื่อและเบอร์โทร
  const fullName = getTextField(formData, "full_name");
  const phone = getTextField(formData, "phone");

  if (!fullName || fullName.length > 100) {
    redirect("/profile?error=invalid_name");
  }
  if (phone && !/^[0-9+\-\s]{9,15}$/.test(phone)) {
    redirect("/profile?error=invalid_phone");
  }

  // ข้อมูลเฉพาะ Companion: ต้องกรอกครบทุกช่อง
  const isCompanion = profile.role === "companion";
  const bio = getTextField(formData, "bio");
  const skills = getTextField(formData, "skills");
  const serviceAreas = getTextField(formData, "service_areas");
  const availableDays = getTextField(formData, "available_days");
  const isAvailable = formData.get("is_available") === "on";

  if (isCompanion && (!bio || !skills || !serviceAreas || !availableDays)) {
    redirect("/profile?error=incomplete_companion");
  }

  // จัดการรูปโปรไฟล์ (ถ้ามีการเลือกไฟล์ใหม่)
  let newAvatarUrl: string | null = null;
  const avatarFile = formData.get("avatar");

  if (avatarFile instanceof File && avatarFile.size > 0) {
    const extension = AVATAR_TYPES[avatarFile.type];
    if (!extension) {
      redirect("/profile?error=invalid_image_type");
    }
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      redirect("/profile?error=image_too_large");
    }

    // เก็บไว้ในโฟลเดอร์ที่ชื่อเป็น user id ของตนเอง (Storage policy ตรวจโฟลเดอร์นี้)
    const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, avatarFile, { contentType: avatarFile.type, upsert: false });

    if (uploadError) {
      console.error("อัปโหลดรูปโปรไฟล์ไม่สำเร็จ:", uploadError.message);
      redirect("/profile?error=upload_failed");
    }

    newAvatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath).data.publicUrl;
  }

  // อัปเดตตาราง profiles (เฉพาะคอลัมน์ที่ผู้ใช้แก้ได้ ห้ามส่ง role)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("อัปเดต profiles ไม่สำเร็จ:", profileError.message);
    redirect("/profile?error=save_failed");
  }

  // ถ้าเปลี่ยนรูปสำเร็จ ลบรูปเก่าที่อยู่ใน Bucket ของเรา (ถ้าลบไม่ได้ก็ไม่เป็นไร)
  if (newAvatarUrl && profile.avatar_url) {
    const marker = `/${AVATAR_BUCKET}/`;
    const index = profile.avatar_url.indexOf(marker);
    if (index !== -1) {
      const oldPath = profile.avatar_url.slice(index + marker.length);
      if (oldPath.startsWith(`${user.id}/`)) {
        await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }
    }
  }

  // อัปเดตข้อมูลผู้ช่วย (เฉพาะ Companion) และตรวจว่ามีแถวถูกอัปเดตจริง
  if (isCompanion) {
    const { data: updatedRows, error: companionError } = await supabase
      .from("companion_profiles")
      .update({
        bio,
        skills,
        service_areas: serviceAreas,
        available_days: availableDays,
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id");

    if (companionError || !updatedRows || updatedRows.length === 0) {
      console.error("อัปเดต companion_profiles ไม่สำเร็จ:", companionError?.message);
      redirect("/profile?error=save_failed");
    }
  }

  // ล้างแคชเพื่อให้ Navbar และหน้ารายชื่อผู้ช่วยแสดงข้อมูลใหม่
  revalidatePath("/profile");
  revalidatePath("/companions");
  revalidatePath("/", "layout");

  redirect("/profile?success=saved");
}
