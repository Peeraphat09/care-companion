"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * ฟังก์ชันช่วยดึงค่าข้อความจาก FormData และตัดช่องว่างหน้าหลัง
 */
function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action สำหรับสร้างคำขอรับบริการใหม่ (Create Service Request)
 * 1. ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่ (ถ้าไม่ ให้ส่งกลับหน้าแรก)
 * 2. รับค่าข้อมูลจาก FormData และตรวจสอบความครบถ้วน
 * 3. บันทึกคำขอลงในตาราง public.service_requests
 *    - กำหนด customer_id เป็น id ของผู้ใช้ปัจจุบัน
 *    - กำหนด status เริ่มต้นเป็น 'pending'
 * 4. รีเฟรชหน้าแคช และ redirect ไปยัง /my-requests พร้อมส่งพารามิเตอร์แจ้งสำเร็จ
 */
export async function createServiceRequest(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบข้อมูลผู้ใช้ที่กำลังเข้าสู่ระบบ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // หากยังไม่ได้เข้าสู่ระบบ ไม่อนุญาตให้สร้างคำขอ
  if (!user) {
    redirect("/");
  }

  // อนุญาตเฉพาะ Customer สร้างคำขอ (ถ้าอ่าน role ไม่ได้ให้ปฏิเสธไว้ก่อน)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "customer") {
    redirect("/my-requests?error=customer_only");
  }

  // ดึงค่าต่าง ๆ จากแบบฟอร์ม
  const taskType = getTextField(formData, "task_type");
  const origin = getTextField(formData, "origin");
  const destination = getTextField(formData, "destination");
  const appointmentDate = getTextField(formData, "appointment_date");
  const durationHoursRaw = getTextField(formData, "duration_hours");
  const notes = getTextField(formData, "notes");
  const companionId = getTextField(formData, "companion_id");

  // ตรวจสอบค่าที่จำเป็นต้องกรอก
  if (!taskType || !origin || !destination || !appointmentDate || !durationHoursRaw) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=incomplete`
      : "/requests/new?error=incomplete";
    redirect(errorUrl);
  }

  // ตรวจสอบความถูกต้องของวันเวลานัดหมาย
  // ค่าจาก datetime-local ไม่มี timezone (เช่น 2026-10-01T09:00) จึงกำหนดเป็นเวลาไทย +07:00 ให้ชัดเจน
  const parsedDate = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(appointmentDate)
      ? `${appointmentDate}:00+07:00`
      : appointmentDate,
  );
  if (isNaN(parsedDate.getTime())) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=invalid_date`
      : "/requests/new?error=invalid_date";
    redirect(errorUrl);
  }

  // ป้องกันการจองงานย้อนเวลา (Time Travel Booking)
  if (parsedDate.getTime() < Date.now()) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=past_date`
      : "/requests/new?error=past_date";
    redirect(errorUrl);
  }

  // ระยะเวลาต้องเป็นจำนวนเต็มระหว่าง 1 - 24 ชั่วโมง (ไม่ปัดทศนิยมเงียบ ๆ)
  const durationHours = Number(durationHoursRaw);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 24) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=invalid_duration`
      : "/requests/new?error=invalid_duration";
    redirect(errorUrl);
  }

  // คำขอเจาะจง: ผู้ช่วยต้องมีอยู่จริง เป็น Companion เปิดรับงาน และไม่ใช่ตัวผู้ใช้เอง
  if (companionId) {
    const { data: target } = await supabase
      .from("companion_profiles")
      .select("id, profiles!inner(role)")
      .eq("id", companionId)
      .eq("is_available", true)
      .eq("profiles.role", "companion")
      .maybeSingle();

    if (!target || companionId === user.id) {
      redirect("/requests/new?error=invalid_companion");
    }
  }

  // บันทึกข้อมูลคำขอลงในตาราง public.service_requests
  const { error: insertError } = await supabase
    .from("service_requests")
    .insert({
      customer_id: user.id,
      companion_id: companionId || null,
      task_type: taskType,
      origin,
      destination,
      appointment_date: parsedDate.toISOString(),
      duration_hours: durationHours,
      notes: notes || null,
      status: "pending",
    });

  if (insertError) {
    console.error("Supabase Insert Error:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=save&reason=${encodeURIComponent(insertError.message)}`
      : `/requests/new?error=save&reason=${encodeURIComponent(insertError.message)}`;
    redirect(errorUrl);
  }

  // ล้างแคชหน้ารายการคำขอเพื่อให้แสดงข้อมูลใหม่ล่าสุดทันที
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  // ส่งผู้ใช้ไปยังหน้าติดตามคำขอ พร้อมแจ้งความสำเร็จ
  redirect("/my-requests?success=created");
}
