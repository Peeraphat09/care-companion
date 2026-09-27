import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Phone,
  PlusCircle,
  Navigation,
  Check,
  XCircle,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { acceptServiceRequest, updateRequestStatus } from "./actions";

// กำหนด Type ของพารามิเตอร์ URL ในหน้าติดตามคำขอ
type MyRequestsPageProps = {
  searchParams: Promise<{
    tab?: string;
    success?: string;
    error?: string;
  }>;
};

// กำหนด Type ของข้อมูลโปรไฟล์ผู้ใช้
type ProfileInfo = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

// กำหนด Type ของข้อมูลคำขอรับบริการจากตาราง service_requests
type ServiceRequestItem = {
  id: string;
  customer_id: string;
  companion_id: string | null;
  task_type: string;
  origin: string;
  destination: string;
  appointment_date: string;
  duration_hours: number;
  notes: string | null;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  customer?: ProfileInfo | ProfileInfo[] | null;
  companion?: ProfileInfo | ProfileInfo[] | null;
};

/**
 * ฟังก์ชันช่วยดึงข้อมูลโปรไฟล์จาก Supabase PostgREST join
 */
function extractProfile(
  raw: ProfileInfo | ProfileInfo[] | null | undefined,
): ProfileInfo | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[0] : null;
  }
  return raw;
}

/**
 * ฟังก์ชันจัดรูปแบบวันและเวลาเป็นภาษาไทย
 * เช่น วันจันทร์ที่ 28 กันยายน 2567 เวลา 09:30 น.
 */
function formatThaiDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " น.";
  } catch {
    return dateString;
  }
}

/**
 * ฟังก์ชันกำหนดป้ายสถานะงาน (Badge) พร้อมสีที่สื่อความหมายชัดเจน
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return {
        label: "รอผู้ช่วยตอบรับ",
        className: "bg-amber-50 text-amber-800 border-amber-200",
        dotColor: "bg-amber-500",
      };
    case "accepted":
      return {
        label: "ผู้ช่วยตอบรับแล้ว",
        className: "bg-sky-50 text-sky-800 border-sky-200",
        dotColor: "bg-sky-500",
      };
    case "in_progress":
      return {
        label: "กำลังเดินทาง / ให้บริการ",
        className: "bg-indigo-50 text-indigo-800 border-indigo-200",
        dotColor: "bg-indigo-500",
      };
    case "completed":
      return {
        label: "เสร็จสิ้นบริการเรียบร้อย",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dotColor: "bg-emerald-500",
      };
    case "cancelled":
      return {
        label: "ยกเลิกคำขอแล้ว",
        className: "bg-stone-100 text-stone-600 border-stone-200",
        dotColor: "bg-stone-400",
      };
    default:
      return {
        label: status,
        className: "bg-stone-100 text-stone-700 border-stone-200",
        dotColor: "bg-stone-500",
      };
  }
}

/**
 * ฟังก์ชันแปลงรหัสความสำเร็จเป็นข้อความภาษาไทย
 */
function getSuccessMessage(success?: string) {
  if (success === "created") return "สร้างคำขอรับบริการเรียบร้อยแล้ว! กำลังรอผู้ช่วยร่วมเดินทางตอบรับงาน";
  if (success === "accepted") return "ตอบรับงานเรียบร้อยแล้ว! กรุณาตรวจสอบข้อมูลและเตรียมพร้อมเดินทาง";
  if (success === "in_progress") return "เริ่มการเดินทางเรียบร้อยแล้ว ขอให้เดินทางร่วมกันอย่างราบรื่นและปลอดภัย";
  if (success === "completed") return "สิ้นสุดการให้บริการเรียบร้อยแล้ว ขอบคุณที่ร่วมส่งมอบความช่วยเหลือ";
  if (success === "cancelled") return "ยกเลิกคำขอรับบริการเรียบร้อยแล้ว";
  return null;
}

/**
 * ฟังก์ชันแปลงรหัสข้อผิดพลาดเป็นข้อความภาษาไทย
 */
function getErrorMessage(error?: string) {
  if (error === "already_taken") return "คำขอนี้มีผู้ช่วยท่านอื่นตอบรับไปแล้ว";
  if (error === "own_request") return "ไม่สามารถกดรับคำขอที่ตนเองเป็นผู้สร้างได้";
  if (error === "unauthorized") return "คุณไม่มีสิทธิ์ในการดำเนินการนี้";
  if (error === "update_failed") return "เกิดข้อผิดพลาดในการอัปเดตสถานะ กรุณาลองใหม่อีกครั้ง";
  if (error === "not_found") return "ไม่พบข้อมูลคำขอรับบริการที่ระบุ";
  return null;
}

/**
 * ศูนย์รวมติดตามสถานะคำขอรับบริการ และตอบรับงาน (Server Component)
 * - Customer: ดูคำขอที่ตนเองเคยสร้าง พร้อมสถานะและข้อมูลผู้ช่วย
 * - Companion: ดูงานที่รอผู้ช่วย (ตอบรับงานได้) และดูงานที่ตนเองรับแล้ว (เริ่มเดินทาง -> สิ้นสุดบริการ)
 */
export default async function MyRequestsPage({
  searchParams,
}: Readonly<MyRequestsPageProps>) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบการเข้าสู่ระบบ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // บังคับล็อกอิน หากยังไม่มี Session ให้ส่งกลับหน้าแรก
  if (!user) {
    redirect("/");
  }

  // ดึงค่า Parameters จาก URL
  const { tab, success, error } = await searchParams;
  const successMessage = getSuccessMessage(success);
  const errorMessage = getErrorMessage(error);

  // ดึงข้อมูลโปรไฟล์และสิทธิ์ (role) ของผู้ใช้
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const isCompanion = profile?.role === "companion";

  // กำหนดแท็บเริ่มต้น: หากเป็น Companion ค่าเริ่มต้นคือ 'open' (งานที่รอผู้ช่วย) หรือ 'my-jobs'
  const activeTab = tab || (isCompanion ? "open" : "customer_requests");

  // 1. ดึงคำขอที่ผู้ใช้สร้างเองในฐานะ Customer
  const { data: rawCustomerRequests } = await supabase
    .from("service_requests")
    .select(`
      id,
      customer_id,
      companion_id,
      task_type,
      origin,
      destination,
      appointment_date,
      duration_hours,
      notes,
      status,
      created_at,
      companion:companion_id (
        id,
        full_name,
        avatar_url,
        phone
      )
    `)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const customerRequests: ServiceRequestItem[] = rawCustomerRequests || [];

  // 2. หากเป็น Companion: ดึงคำขอที่รอผู้ช่วย (pending)
  let openRequests: ServiceRequestItem[] = [];
  if (isCompanion) {
    const { data: rawOpenRequests } = await supabase
      .from("service_requests")
      .select(`
        id,
        customer_id,
        companion_id,
        task_type,
        origin,
        destination,
        appointment_date,
        duration_hours,
        notes,
        status,
        created_at,
        customer:customer_id (
          id,
          full_name,
          avatar_url,
          phone
        )
      `)
      .eq("status", "pending")
      .neq("customer_id", user.id)
      .or(`companion_id.is.null,companion_id.eq.${user.id}`)
      .order("appointment_date", { ascending: true });

    openRequests = rawOpenRequests || [];
  }

  // 3. หากเป็น Companion: ดึงงานที่ตนเองรับไว้ (accepted, in_progress, completed)
  let companionJobs: ServiceRequestItem[] = [];
  if (isCompanion) {
    const { data: rawCompanionJobs } = await supabase
      .from("service_requests")
      .select(`
        id,
        customer_id,
        companion_id,
        task_type,
        origin,
        destination,
        appointment_date,
        duration_hours,
        notes,
        status,
        created_at,
        customer:customer_id (
          id,
          full_name,
          avatar_url,
          phone
        )
      `)
      .eq("companion_id", user.id)
      .in("status", ["accepted", "in_progress", "completed"])
      .order("appointment_date", { ascending: true });

    companionJobs = rawCompanionJobs || [];
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      {/* ส่วนหัวของหน้า */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            <Briefcase className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            ศูนย์บริหารจัดการคำขอรับบริการ
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {isCompanion ? "ศูนย์รวมงานและคำขอรับบริการ" : "รายการคำขอรับบริการของฉัน"}
          </h1>
          <p className="mt-1 text-sm text-stone-600 sm:text-base">
            {isCompanion
              ? "ตรวจสอบงานที่รอการตอบรับ และอัปเดตสถานะงานที่คุณกำลังดูแล"
              : "ติดตามสถานะคำขอรับบริการของคุณตั้งแต่รอการตอบรับจนสิ้นสุดการเดินทาง"}
          </p>
        </div>

        {/* ปุ่มสร้างคำขอใหม่ */}
        <Link
          href="/requests/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          <span>สร้างคำขอใหม่</span>
        </Link>
      </div>

      {/* ข้อความย้ำเตือนขอบเขตบริการที่เข้มงวด */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="text-sm leading-6">
          <strong className="font-semibold">ข้อตกลงและขอบเขตหน้าที่สำคัญ:</strong>{" "}
          ผู้ช่วยร่วมเดินทางมีหน้าที่ช่วยเหลือการเดินทางและอำนวยความสะดวกในการทำธุระเท่านั้น
          <strong className="text-amber-950"> ไม่ใช่บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วยโดยเด็ดขาด</strong>
        </div>
      </div>

      {/* กล่องแจ้งเตือนผลการดำเนินงาน (Success Alert) */}
      {successMessage && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* กล่องแจ้งเตือนข้อผิดพลาด (Error Alert) */}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* แถบสลับแท็บ (Tab Navigation สำหรับผู้ใช้ที่มีบทบาทเป็น Companion) */}
      {isCompanion && (
        <div className="mt-8 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          {/* แท็บ 1: งานที่รอผู้ช่วยตอบรับ */}
          <Link
            href="/my-requests?tab=open"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "open"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            <span>งานที่รอผู้ช่วย (Open Requests)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "open"
                  ? "bg-white/20 text-white"
                  : "bg-teal-100 text-teal-800"
              }`}
            >
              {openRequests.length}
            </span>
          </Link>

          {/* แท็บ 2: งานที่ฉันกำลังดูแล */}
          <Link
            href="/my-requests?tab=my-jobs"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "my-jobs"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            <span>งานที่ฉันดูแล (My Jobs)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "my-jobs"
                  ? "bg-white/20 text-white"
                  : "bg-stone-100 text-stone-700"
              }`}
            >
              {companionJobs.length}
            </span>
          </Link>

          {/* แท็บ 3: คำขอที่ฉันสร้างเองในฐานะลูกค้า */}
          <Link
            href="/my-requests?tab=customer_requests"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "customer_requests"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            <span>คำขอที่ฉันสร้างเอง</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "customer_requests"
                  ? "bg-white/20 text-white"
                  : "bg-stone-100 text-stone-700"
              }`}
            >
              {customerRequests.length}
            </span>
          </Link>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ส่วนที่ 1: งานที่รอผู้ช่วยตอบรับ (สำหรับ Companion) */}
      {/* ========================================================================= */}
      {isCompanion && activeTab === "open" && (
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-stone-900">
              รายการคำขอที่รอผู้ช่วยร่วมเดินทาง ({openRequests.length} รายการ)
            </h2>
            <p className="text-xs text-stone-500">
              ตรวจสอบวันเวลาและสถานที่ หากคุณสะดวก สามารถกดปุ่ม &ldquo;ตอบรับงาน&rdquo; เพื่อยืนยันช่วยเหลือได้ทันที
            </p>
          </div>

          {openRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
              <Clock className="mx-auto h-12 w-12 text-stone-400" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-stone-800">
                ขณะนี้ยังไม่มีคำขอที่รอการตอบรับ
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                เมื่อมีผู้ใช้บริการสร้างคำขอใหม่ รายการจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {openRequests.map((request) => {
                const customerProfile = extractProfile(request.customer);
                const customerName = customerProfile?.full_name || "ผู้ใช้บริการ";
                const isDirectRequest = request.companion_id === user.id;

                return (
                  <article
                    key={request.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-teal-300 sm:p-6"
                  >
                    <div>
                      {/* แถบหัวการ์ด: Badge ประเภทธุระ และสถานะเจาะจง */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 border border-teal-200">
                            {request.task_type}
                          </span>
                          {isDirectRequest && (
                            <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 animate-pulse">
                              คำขอเจาะจงถึงคุณโดยตรง
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-400">
                          สร้างเมื่อ {formatThaiDateTime(request.created_at)}
                        </span>
                      </div>

                      {/* ข้อมูลเส้นทาง ต้นทาง -> ปลายทาง */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">สถานที่ต้นทาง (จุดนัดพบ)</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{request.origin}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">จุดหมายปลายทาง</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{request.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* วันเวลานัดหมาย และระยะเวลา */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-stone-600 sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-sky-600" aria-hidden="true" />
                          <span className="font-semibold text-stone-700">เวลานัดหมาย:</span>
                          <span>{formatThaiDateTime(request.appointment_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                          <span className="font-semibold text-stone-700">ระยะเวลา:</span>
                          <span>ประมาณ {request.duration_hours} ชั่วโมง</span>
                        </div>
                      </div>

                      {/* ข้อมูลผู้ขอรับบริการ และข้อความบันทึก */}
                      <div className="mt-4 border-t border-stone-100 pt-3">
                        <div className="flex items-center gap-3">
                          {customerProfile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={customerProfile.avatar_url}
                              alt={customerName}
                              className="h-8 w-8 rounded-full border border-stone-200 object-cover"
                              width={32}
                              height={32}
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                              {customerName.slice(0, 1)}
                            </div>
                          )}
                          <div className="text-xs">
                            <span className="text-stone-500">ผู้ขอรับบริการ:</span>{" "}
                            <span className="font-semibold text-stone-800">{customerName}</span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="mt-2.5 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600">
                            <strong className="font-semibold text-stone-700">รายละเอียดเพิ่มเติม:</strong>{" "}
                            {request.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ปุ่มสำหรับกด "ตอบรับงาน (Accept)" */}
                    <div className="mt-5 pt-3 border-t border-stone-100">
                      <form action={acceptServiceRequest} className="w-full">
                        <input type="hidden" name="request_id" value={request.id} />
                        <button
                          type="submit"
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          <span>ตอบรับงานนี้ (Accept Request)</span>
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* ส่วนที่ 2: งานที่ฉันกำลังดูแล (สำหรับ Companion ที่รับงานแล้ว) */}
      {/* ========================================================================= */}
      {isCompanion && activeTab === "my-jobs" && (
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-stone-900">
              งานที่คุณรับมอบหมาย ({companionJobs.length} รายการ)
            </h2>
            <p className="text-xs text-stone-500">
              อัปเดตสถานะการเดินทางตามความคืบหน้าจริง: &ldquo;เริ่มเดินทาง&rdquo; เมื่อออกเดินทาง และ &ldquo;สิ้นสุดบริการ&rdquo; เมื่อเสร็จภารกิจ
            </p>
          </div>

          {companionJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
              <Briefcase className="mx-auto h-12 w-12 text-stone-400" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-stone-800">
                คุณยังไม่มีงานที่รับไว้ในขณะนี้
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                สามารถตรวจสอบคำขอที่รอผู้ช่วยในแท็บ &ldquo;งานที่รอผู้ช่วย&rdquo; เพื่อกดรับงานได้
              </p>
              <div className="mt-5">
                <Link
                  href="/my-requests?tab=open"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  ดูงานที่เปิดรับ
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              {companionJobs.map((job) => {
                const customerProfile = extractProfile(job.customer);
                const customerName = customerProfile?.full_name || "ผู้ใช้บริการ";
                const customerPhone = customerProfile?.phone;
                const statusBadge = getStatusBadge(job.status);

                return (
                  <article
                    key={job.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition sm:p-6"
                  >
                    <div>
                      {/* หัวการ์ด: Badge สถานะงาน และประเภทธุระ */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotColor}`} />
                            {statusBadge.label}
                          </span>
                          <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                            {job.task_type}
                          </span>
                        </div>
                        <span className="text-xs text-stone-400">
                          {formatThaiDateTime(job.appointment_date)}
                        </span>
                      </div>

                      {/* ข้อมูลสถานที่ ต้นทาง -> ปลายทาง */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">ต้นทาง (จุดนัดพบ)</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{job.origin}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">ปลายทาง</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{job.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* ข้อมูลลูกค้าและช่องทางติดต่อ */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-2.5">
                          {customerProfile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={customerProfile.avatar_url}
                              alt={customerName}
                              className="h-8 w-8 rounded-full border border-stone-200 object-cover"
                              width={32}
                              height={32}
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                              {customerName.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-stone-800">{customerName}</span>
                            <span className="ml-1.5 text-xs text-stone-500">(ผู้ใช้บริการ)</span>
                          </div>
                        </div>

                        {customerPhone && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                            <Phone className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                            <span>{customerPhone}</span>
                          </div>
                        )}
                      </div>

                      {job.notes && (
                        <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600">
                          <strong className="font-semibold text-stone-700">ข้อควรระวัง/รายละเอียด:</strong>{" "}
                          {job.notes}
                        </div>
                      )}
                    </div>

                    {/* ปุ่มสำหรับเปลี่ยนสถานะงานตาม User Flow */}
                    <div className="mt-5 pt-3 border-t border-stone-100">
                      {job.status === "accepted" && (
                        /* เริ่มเดินทาง -> in_progress */
                        <form action={updateRequestStatus} className="w-full">
                          <input type="hidden" name="request_id" value={job.id} />
                          <input type="hidden" name="status" value="in_progress" />
                          <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
                          >
                            <Navigation className="h-4 w-4" aria-hidden="true" />
                            <span>เริ่มเดินทาง (In Progress)</span>
                          </button>
                        </form>
                      )}

                      {job.status === "in_progress" && (
                        /* สิ้นสุดบริการ -> completed */
                        <form action={updateRequestStatus} className="w-full">
                          <input type="hidden" name="request_id" value={job.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            <span>สิ้นสุดบริการเรียบร้อย (Completed)</span>
                          </button>
                        </form>
                      )}

                      {job.status === "completed" && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                          <span>ภารกิจบริการนี้เสร็จสิ้นสมบูรณ์แล้ว</span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* ส่วนที่ 3: คำขอที่ผู้ใช้สร้างเอง (สำหรับ Customer หรือ Companion ที่สร้างคำขอ) */}
      {/* ========================================================================= */}
      {(!isCompanion || activeTab === "customer_requests") && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              คำขอรับบริการที่คุณสร้างไว้ ({customerRequests.length} รายการ)
            </h2>
          </div>

          {customerRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
              <Calendar className="mx-auto h-12 w-12 text-stone-400" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-stone-800">
                คุณยังไม่มีคำขอรับบริการในขณะนี้
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                เมื่อคุณต้องการผู้ช่วยร่วมเดินทางไปทำธุระ สามารถสร้างคำขอรับบริการใหม่ได้ตลอดเวลา
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/companions"
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                >
                  ค้นหาผู้ช่วยร่วมเดินทาง
                </Link>
                <Link
                  href="/requests/new"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
                >
                  สร้างคำขอรับบริการ
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              {customerRequests.map((request) => {
                const companionProfile = extractProfile(request.companion);
                const companionName = companionProfile?.full_name;
                const statusBadge = getStatusBadge(request.status);

                return (
                  <article
                    key={request.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition sm:p-6"
                  >
                    <div>
                      {/* หัวการ์ด: Badge สถานะ และประเภทธุระ */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotColor}`} />
                            {statusBadge.label}
                          </span>
                          <span className="rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                            {request.task_type}
                          </span>
                        </div>
                        <span className="text-xs text-stone-400">
                          ส่งคำขอเมื่อ {formatThaiDateTime(request.created_at)}
                        </span>
                      </div>

                      {/* รายละเอียดสถานที่ ต้นทาง -> ปลายทาง */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">ต้นทาง (จุดนัดพบ)</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{request.origin}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-semibold text-stone-500">ปลายทาง</p>
                            <p className="mt-0.5 text-sm font-medium text-stone-800">{request.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* วันเวลานัดหมาย และระยะเวลา */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-stone-600 sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-sky-600" aria-hidden="true" />
                          <span className="font-semibold text-stone-700">เวลานัดหมาย:</span>
                          <span>{formatThaiDateTime(request.appointment_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                          <span className="font-semibold text-stone-700">ระยะเวลา:</span>
                          <span>ประมาณ {request.duration_hours} ชั่วโมง</span>
                        </div>
                      </div>

                      {/* ข้อมูลผู้ช่วยที่ตอบรับงาน (ถ้ามี) */}
                      <div className="mt-4 border-t border-stone-100 pt-3">
                        {companionName ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {companionProfile?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={companionProfile.avatar_url}
                                  alt={companionName}
                                  className="h-9 w-9 rounded-full border border-teal-200 object-cover"
                                  width={36}
                                  height={36}
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                                  {companionName.slice(0, 1)}
                                </div>
                              )}
                              <div className="text-xs sm:text-sm">
                                <p className="font-bold text-stone-900">{companionName}</p>
                                <p className="text-xs text-teal-700 font-medium">ผู้ช่วยร่วมเดินทางของคุณ</p>
                              </div>
                            </div>

                            {companionProfile?.phone && (
                              <div className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                                <Phone className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                                <span>{companionProfile.phone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <Clock className="h-4 w-4 animate-spin text-amber-500" aria-hidden="true" />
                            <span>กำลังรอผู้ช่วยร่วมเดินทางตอบรับงาน</span>
                          </div>
                        )}

                        {request.notes && (
                          <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600">
                            <strong className="font-semibold text-stone-700">รายละเอียดเพิ่มเติม:</strong>{" "}
                            {request.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* กรณีสถานะยังเป็น pending: สามารถกดยกเลิกคำขอได้ */}
                    {request.status === "pending" && (
                      <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
                        <form action={updateRequestStatus}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 hover:text-red-600"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>ยกเลิกคำขอนี้</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
