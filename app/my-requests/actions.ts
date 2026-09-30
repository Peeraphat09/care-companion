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
 * 3. ตรวจสอบว่าคำขอยัง 'pending', ยังไม่เลยเวลานัด และเป็นคำขอแบบเปิดหรือเจาะจงถึงตนเอง
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

  // ตรวจสอบสิทธิ์: ต้องเป็น Companion เท่านั้น (ถ้าอ่าน role ไม่ได้ให้ปฏิเสธไว้ก่อน)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "companion") {
    redirect("/my-requests?error=unauthorized");
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

  // คำขอเจาะจง: ต้องเป็นผู้ช่วยที่ถูกระบุเท่านั้น (กันแย่งงานของคนอื่น)
  if (request.companion_id && request.companion_id !== user.id) {
    redirect("/my-requests?error=unauthorized");
  }

  // คำขอที่เลยเวลานัดแล้วรับไม่ได้
  const appointmentStart = new Date(request.appointment_date);
  if (appointmentStart.getTime() < Date.now()) {
    redirect("/my-requests?error=expired");
  }

  // ป้องกันการรับงานซ้อนทับกัน (Scheduling Conflicts)
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

  // อัปเดตคำขอ: บันทึก companion_id และเปลี่ยนสถานะเป็น 'accepted'
  // เงื่อนไข: ยัง pending และเป็นคำขอแบบเปิดหรือของตนเอง (ป้องกัน Race condition)
  // .select("id") เพื่อตรวจว่ามีแถวถูกอัปเดตจริงหรือไม่
  const { data: updatedRows, error: updateError } = await supabase
    .from("service_requests")
    .update({
      companion_id: user.id,
      status: "accepted",
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .or(`companion_id.is.null,companion_id.eq.${user.id}`)
    .select("id");

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการตอบรับงาน:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  // ไม่มีแถวถูกอัปเดต = มีคนรับไปก่อนแล้ว
  if (!updatedRows || updatedRows.length === 0) {
    redirect("/my-requests?error=already_taken");
  }

  // อัปเดต Cache เพื่อให้หน้าเว็บดึงข้อมูลใหม่
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  redirect("/my-requests?success=accepted");
}

/**
 * Server Action: Companion ปฏิเสธคำขอที่เจาะจงถึงตนเอง
 * - ทำได้เฉพาะ Companion ที่ถูกระบุ และคำขอยัง 'pending'
 * - ไม่ยกเลิกคำขอของลูกค้า แต่คืน companion_id เป็น null ให้กลายเป็นคำขอแบบเปิด
 */
export async function rejectDirectRequest(formData: FormData) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

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

  // เงื่อนไขในคำสั่งเดียว: เป็นคำขอของ Companion คนนี้ และยัง pending เท่านั้น
  const { data: updatedRows, error: updateError } = await supabase
    .from("service_requests")
    .update({ companion_id: null })
    .eq("id", requestId)
    .eq("companion_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการปฏิเสธคำขอ:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  if (!updatedRows || updatedRows.length === 0) {
    redirect("/my-requests?error=unauthorized");
  }

  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  redirect("/my-requests?success=rejected");
}

/**
 * Server Action: อัปเดตสถานะงาน
 * ลำดับที่อนุญาต (ตรวจกับสถานะปัจจุบันเสมอ):
 * - Companion ที่ได้รับมอบหมาย: accepted -> in_progress -> completed
 * - Customer เจ้าของคำขอ หรือ Companion ที่รับงาน: pending/accepted -> cancelled
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

  const isAssignedCompanion = request.companion_id === user.id;
  const isCustomer = request.customer_id === user.id;

  // ตรวจสอบสิทธิ์ตามประเภทการเปลี่ยนสถานะ
  if (newStatus === "in_progress" || newStatus === "completed") {
    // เฉพาะ Companion ที่ได้รับมอบหมายเท่านั้น
    if (!isAssignedCompanion) {
      redirect("/my-requests?error=unauthorized");
    }
  } else if (!isCustomer && !isAssignedCompanion) {
    // ยกเลิกได้เฉพาะเจ้าของคำขอหรือ Companion ที่รับงาน
    redirect("/my-requests?error=unauthorized");
  }

  // ตรวจลำดับสถานะ: ห้ามข้ามขั้นหรือย้อนกลับ
  const allowedFrom: Record<string, string[]> = {
    in_progress: ["accepted"],
    completed: ["in_progress"],
    cancelled: ["pending", "accepted"],
  };
  if (!allowedFrom[newStatus].includes(request.status)) {
    redirect(
      newStatus === "cancelled"
        ? "/my-requests?error=cannot_cancel"
        : "/my-requests?error=invalid_transition",
    );
  }

  // อัปเดตสถานะ พร้อมเช็กสถานะเดิมป้องกัน Race condition และตรวจว่ามีแถวถูกอัปเดตจริง
  const { data: updatedRows, error: updateError } = await supabase
    .from("service_requests")
    .update({
      status: newStatus,
    })
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id");

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการอัปเดตสถานะงาน:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  if (!updatedRows || updatedRows.length === 0) {
    redirect("/my-requests?error=update_failed");
  }

  // รีเฟรช Cache
  revalidatePath("/my-requests");
  revalidatePath("/", "layout");

  redirect(`/my-requests?success=${newStatus}`);
}
