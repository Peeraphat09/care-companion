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
 * Server Action: ตอบรับงานบริการ (สำหรับ Companion)
 * 1. ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
 * 2. ตรวจสอบสิทธิ์ว่าผู้ใช้เป็น Companion หรือไม่
 * 3. ตรวจสอบว่าคำขอนั้นยังมีสถานะ 'pending' และยังไม่มีใครรับไปก่อนหน้า
 * 4. อัปเดต companion_id เป็น id ของผู้ใช้ปัจจุบัน และเปลี่ยน status เป็น 'accepted'
 * 5. รีเฟรช Cache และส่งผู้ใช้กลับหน้ารายการคำขอ
 */
export async function acceptServiceRequest(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบข้อมูลผู้ใช้ปัจจุบัน
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const requestId = getTextField(formData, "request_id");
  if (!requestId) {
    redirect("/my-requests?error=missing_id");
  }

  // ดึงข้อมูลคำขอปัจจุบันเพื่อตรวจสอบสถานะก่อนรับงาน
  const { data: request, error: fetchError } = await supabase
    .from("service_requests")
    .select("id, customer_id, companion_id, status, appointment_date, duration_hours")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    console.error("ไม่พบคำขอรับบริการที่ต้องการรับงาน:", fetchError?.message);
    redirect("/my-requests?error=not_found");
  }

  // ป้องกันไม่ให้รับงานของตนเอง
  if (request.customer_id === user.id) {
    redirect("/my-requests?error=own_request");
  }

  // ตรวจสอบว่าคำขอนี้ยังเปิดรอผู้ช่วยอยู่หรือไม่
  if (request.status !== "pending") {
    redirect("/my-requests?error=already_taken");
  }

  // ป้องกันการรับงานซ้อนทับกัน (Scheduling Conflicts)
  const appointmentStart = new Date(request.appointment_date);
  const appointmentEnd = new Date(appointmentStart.getTime() + request.duration_hours * 3600000);

  const { data: activeJobs } = await supabase
    .from("service_requests")
    .select("appointment_date, duration_hours")
    .eq("companion_id", user.id)
    .in("status", ["accepted", "in_progress"]);
    
  if (activeJobs) {
    for (const job of activeJobs) {
      const jobStart = new Date(job.appointment_date);
      const jobEnd = new Date(jobStart.getTime() + job.duration_hours * 3600000);
      if (appointmentStart < jobEnd && jobStart < appointmentEnd) {
        redirect("/my-requests?error=schedule_conflict");
      }
    }
  }

  // อัปเดตคำขอ: บันทึก companion_id และเปลี่ยนสถานะเป็น 'accepted' พร้อมป้องกัน Race condition
  const { error: updateError } = await supabase
    .from("service_requests")
    .update({
      companion_id: user.id,
      status: "accepted",
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการตอบรับงาน:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  // อัปเดต Cache เพื่อให้หน้าเว็บดึงข้อมูลใหม่
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  redirect("/my-requests?success=accepted");
}

/**
 * Server Action: อัปเดตสถานะงาน (In Progress -> Completed หรือ ยกเลิกงาน)
 * - Companion: สามารถเปลี่ยนจาก 'accepted' -> 'in_progress' (เริ่มเดินทาง)
 *   และจาก 'in_progress' -> 'completed' (สิ้นสุดบริการ)
 * - Customer: สามารถกดยกเลิกงานได้หากสถานะยังเป็น 'pending'
 */
export async function updateRequestStatus(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบข้อมูลผู้ใช้ปัจจุบัน
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const requestId = getTextField(formData, "request_id");
  const newStatus = getTextField(formData, "status");

  // ตรวจสอบค่าสถานะที่อนุญาตให้เปลี่ยน
  const allowedStatuses = ["in_progress", "completed", "cancelled"];
  if (!requestId || !allowedStatuses.includes(newStatus)) {
    redirect("/my-requests?error=invalid_status");
  }

  // ดึงข้อมูลคำขอเพื่อตรวจสอบสิทธิ์การเปลี่ยนสถานะ
  const { data: request, error: fetchError } = await supabase
    .from("service_requests")
    .select("id, customer_id, companion_id, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    console.error("ไม่พบคำขอรับบริการ:", fetchError?.message);
    redirect("/my-requests?error=not_found");
  }

  // ตรวจสอบสิทธิ์:
  // หากเป็น Companion ต้องเป็นผู้ที่ได้รับมอบหมายงานนี้
  // หากเป็น Customer ต้องเป็นเจ้าของคำขอและอนุญาตให้ยกเลิกเฉพาะตอน pending
  const isAssignedCompanion = request.companion_id === user.id;
  const isCustomer = request.customer_id === user.id;

  if (newStatus === "in_progress" || newStatus === "completed") {
    if (!isAssignedCompanion) {
      redirect("/my-requests?error=unauthorized");
    }
  } else if (newStatus === "cancelled") {
    if (!isCustomer && !isAssignedCompanion) {
      redirect("/my-requests?error=unauthorized");
    }
    // ลูกค้าสามารถยกเลิกได้เฉพาะตอนที่สถานะยังเป็น pending หรือ accepted เท่านั้น
    if (request.status !== "pending" && request.status !== "accepted") {
      redirect("/my-requests?error=cannot_cancel");
    }
  }

  // อัปเดตสถานะคำขอรับบริการ พร้อมเช็กสถานะเดิมป้องกัน Race condition
  const { error: updateError } = await supabase
    .from("service_requests")
    .update({
      status: newStatus,
    })
    .eq("id", requestId)
    .eq("status", request.status);

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการอัปเดตสถานะงาน:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  // รีเฟรช Cache
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  redirect(`/my-requests?success=${newStatus}`);
}
