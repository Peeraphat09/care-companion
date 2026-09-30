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
 * 2. เรียกฟังก์ชัน accept_service_request ใน Supabase (SECURITY DEFINER) ซึ่งตรวจทุกเงื่อนไขและอัปเดตในที่เดียว:
 *    เป็น Companion, คำขอยัง 'pending', ไม่ใช่ของตนเอง, เป็นคำขอแบบเปิดหรือเจาะจงถึงตนเอง,
 *    ยังไม่เลยเวลานัด, เวลาไม่ซ้อนกับงานที่รับไว้ (ล็อกแถวกันรับพร้อมกัน)
 *    ทำผ่านฟังก์ชันเพื่อไม่ต้องเปิดสิทธิ์ UPDATE คำขอของคนอื่นใน RLS
 * 3. แปลงผลลัพธ์เป็นรหัส error/success แล้วส่งผู้ใช้กลับหน้ารายการคำขอ
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

  // เรียกฟังก์ชันใน DB: คืนข้อความ 'ok' หรือรหัส error
  const { data: result, error: rpcError } = await supabase.rpc("accept_service_request", {
    p_request_id: requestId,
  });

  if (rpcError) {
    console.error("เกิดข้อผิดพลาดในการตอบรับงาน:", rpcError.message);
    redirect("/my-requests?error=update_failed");
  }

  // รหัสที่ฟังก์ชันคืนมาซึ่งหน้า /my-requests มีข้อความรองรับ
  const knownErrors = [
    "unauthorized",
    "not_found",
    "own_request",
    "already_taken",
    "expired",
    "schedule_conflict",
  ];
  if (result !== "ok") {
    redirect(
      `/my-requests?error=${knownErrors.includes(String(result)) ? result : "update_failed"}`,
    );
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

  // เรียกฟังก์ชัน reject_direct_request ใน Supabase (SECURITY DEFINER)
  // เพราะนโยบาย RLS ไม่ให้ Companion ตั้ง companion_id เป็น null ตรง ๆ
  // ฟังก์ชันนี้แก้ได้เฉพาะคำขอที่ระบุถึงผู้เรียกและยัง pending แล้วคืนจำนวนแถวที่แก้
  const { data: updatedCount, error: updateError } = await supabase.rpc(
    "reject_direct_request",
    { p_request_id: requestId },
  );

  if (updateError) {
    console.error("เกิดข้อผิดพลาดในการปฏิเสธคำขอ:", updateError.message);
    redirect("/my-requests?error=update_failed");
  }

  if (!updatedCount) {
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
