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
  const parsedDate = new Date(appointmentDate);
  if (isNaN(parsedDate.getTime())) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=invalid_date`
      : "/requests/new?error=invalid_date";
    redirect(errorUrl);
  }

  // แปลงระยะเวลาเป็นตัวเลขจำนวนเต็มบวก
  const durationHours = parseInt(durationHoursRaw, 10);
  if (isNaN(durationHours) || durationHours <= 0) {
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=invalid_duration`
      : "/requests/new?error=invalid_duration";
    redirect(errorUrl);
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
    console.error("เกิดข้อผิดพลาดในการบันทึกคำขอรับบริการ:", insertError.message);
    const errorUrl = companionId
      ? `/requests/new?companion_id=${companionId}&error=save`
      : "/requests/new?error=save";
    redirect(errorUrl);
  }

  // ล้างแคชหน้ารายการคำขอเพื่อให้แสดงข้อมูลใหม่ล่าสุดทันที
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  // ส่งผู้ใช้ไปยังหน้าติดตามคำขอ พร้อมแจ้งความสำเร็จ
  redirect("/my-requests?created=success");
}
