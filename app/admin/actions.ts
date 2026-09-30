"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/utils/supabase/server";

// กำหนดรายการ Role ที่ระบบรองรับ
type AllowedRole = "customer" | "companion" | "admin";

/**
 * ฟังก์ชันช่วยดึงค่าข้อความจาก FormData และตัดช่องว่างหน้าหลัง
 */
function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action: เปลี่ยนสิทธิ์ (Role) ของผู้ใช้งานในระบบ (สำหรับ Admin)
 * 1. ตรวจสอบว่าผู้ใช้ที่เรียก Action ล็อกอินอยู่หรือไม่
 * 2. ตรวจสอบว่าผู้ใช้ปัจจุบันมี role === 'admin' ในตาราง public.profiles หรือไม่
 * 3. ตรวจสอบค่า target_user_id และ new_role ที่ส่งมา
 * 4. ป้องกันไม่ให้แอดมินลดสิทธิ์ตนเองจนไม่เหลือผู้ดูแลระบบ
 * 5. หากเปลี่ยนเป็น companion และยังไม่มีข้อมูลใน companion_profiles ให้สร้างข้อมูลเริ่มต้น
 * 6. อัปเดตฟิลด์ role ในตาราง public.profiles
 * 7. รีเฟรช Cache และส่งกลับหน้า admin พร้อมข้อความแจ้งเตือนความสำเร็จ
 */
export async function updateUserRole(formData: FormData) {
  // สร้าง Supabase Client ฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบข้อมูลผู้ใช้ปัจจุบันที่ส่งคำขอ
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // หากไม่ได้ล็อกอิน ให้ส่งกลับหน้าแรก
  if (!currentUser) {
    redirect("/");
  }

  // ตรวจสอบสิทธิ์ว่าผู้ใช้ปัจจุบันเป็น 'admin' หรือไม่
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (adminProfile?.role !== "admin") {
    console.error("ผู้ใช้ไม่มีสิทธิ์ admin ในการเปลี่ยน Role");
    redirect("/");
  }

  // ดึงค่าไอดีผู้ใช้เป้าหมายและสิทธิ์ใหม่ที่ต้องการเปลี่ยน
  const targetUserId = getTextField(formData, "user_id");
  const newRole = getTextField(formData, "new_role") as AllowedRole;

  // ตรวจสอบความถูกต้องของสิทธิ์ใหม่
  const validRoles: AllowedRole[] = ["customer", "companion", "admin"];
  if (!targetUserId || !validRoles.includes(newRole)) {
    redirect("/admin?error=invalid_role");
  }

  // ป้องกันไม่ให้ผู้ดูแลระบบลดสิทธิ์ของตนเอง เพื่อป้องกันไม่ให้ระบบไม่มีแอดมินดูแล
  if (targetUserId === currentUser.id && newRole !== "admin") {
    redirect("/admin?error=self_demote");
  }

  // สร้าง Supabase Admin Client สำหรับการบันทึกข้าม RLS
  const supabaseAdmin = createAdminClient();

  // หากเปลี่ยนสิทธิ์เป็น 'companion' ให้ตรวจสอบว่ามีแถวในตาราง companion_profiles แล้วหรือยัง
  // หากยังไม่มี ให้สร้างแถวเริ่มต้นไว้ เพื่อให้แสดงผลในหน้าค้นหาผู้ช่วยได้ถูกต้อง
  if (newRole === "companion") {
    const { data: existingCompanion } = await supabaseAdmin
      .from("companion_profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (existingCompanion) {
      // เคยเป็น Companion แล้วถูกลดสิทธิ์ (is_available ถูกปิดไว้) ให้เปิดรับงานอีกครั้งเมื่อกลับมาเป็น companion
      await supabaseAdmin
        .from("companion_profiles")
        .update({ is_available: true })
        .eq("id", targetUserId);
    } else {
      const { error: insertCompanionError } = await supabaseAdmin
        .from("companion_profiles")
        .insert({
          id: targetUserId,
          bio: "ผู้ช่วยร่วมเดินทาง (ปรับสถานะโดยผู้ดูแลระบบ)",
          skills: "ช่วยเหลือการเดินทางทั่วไป, อำนวยความสะดวก",
          service_areas: "กรุงเทพฯ และปริมณฑล",
          available_days: "จันทร์ - อาทิตย์",
          is_available: true,
        });

      if (insertCompanionError) {
        console.error(
          "เกิดข้อผิดพลาดในการสร้างแถวเริ่มต้น companion_profiles:",
          insertCompanionError.message,
        );
      }
    }
  }

  // อัปเดตสิทธิ์ (role) ของผู้ใช้เป้าหมายในตาราง public.profiles
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการอัปเดตสิทธิ์ผู้ใช้:", updateError.message);
    redirect("/admin?error=update_failed");
  }

  // หากลดสิทธิ์จาก companion เป็นอย่างอื่น: ปิดรับงาน และคืนงานที่ยังไม่เริ่ม (pending เจาะจง / accepted)
  // ให้กลับเป็นคำขอแบบเปิด (งาน in_progress ไม่แตะ เพื่อไม่ให้ทับงานที่กำลังเดินทางอยู่ — Admin ต้องตามดูเอง)
  let hasInProgress = false;
  if (newRole !== "companion") {
    const { error: availableError } = await supabaseAdmin
      .from("companion_profiles")
      .update({ is_available: false })
      .eq("id", targetUserId);

    const { error: releaseError } = await supabaseAdmin
      .from("service_requests")
      .update({ companion_id: null, status: "pending" })
      .eq("companion_id", targetUserId)
      .in("status", ["pending", "accepted"]);

    // ถ้าเก็บกวาดไม่สำเร็จ ต้องแจ้ง Admin (role ถูกเปลี่ยนไปแล้ว แต่งานอาจยังค้าง)
    if (availableError || releaseError) {
      console.error(
        "เกิดข้อผิดพลาดตอนเก็บกวาดหลังลดสิทธิ์:",
        availableError?.message,
        releaseError?.message,
      );
      revalidatePath("/", "layout");
      redirect("/admin?error=cleanup_failed");
    }

    const { count } = await supabaseAdmin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("companion_id", targetUserId)
      .eq("status", "in_progress");
    hasInProgress = (count ?? 0) > 0;
  }

  // สั่ง Revalidate เพื่อเคลียร์ Cache ให้ทุกหน้าเห็น Role ใหม่ทันที
  revalidatePath("/admin");
  revalidatePath("/companions");
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  // ส่งกลับไปยังหน้า admin พร้อมสถานะสำเร็จ
  redirect(hasInProgress ? "/admin?success=role_updated_in_progress" : "/admin?success=role_updated");
}
