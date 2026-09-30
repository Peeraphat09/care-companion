import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  Users,
  UserCheck,
  HeartHandshake,
  ClipboardList,
  Clock,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Phone,
  Shield,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { updateUserRole } from "./actions";

// กำหนด Type ของพารามิเตอร์ URL ในหน้า Admin Dashboard
type AdminPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

// กำหนด Type ข้อมูลโปรไฟล์ของผู้ใช้จากตาราง public.profiles
type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: "customer" | "companion" | "admin";
  created_at: string;
};

// กำหนด Type ข้อมูลความสัมพันธ์โปรไฟล์แบบย่อ
type ProfileBrief = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

// กำหนด Type ข้อมูลคำขอรับบริการจากตาราง public.service_requests
type ServiceRequestRow = {
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
  customer?: ProfileBrief | ProfileBrief[] | null;
  companion?: ProfileBrief | ProfileBrief[] | null;
};

/**
 * ฟังก์ชันช่วยดึงข้อมูลโปรไฟล์เดี่ยวจาก PostgREST relation
 */
function extractProfile(
  raw: ProfileBrief | ProfileBrief[] | null | undefined,
): ProfileBrief | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[0] : null;
  }
  return raw;
}

/**
 * ฟังก์ชันจัดรูปแบบวันและเวลาเป็นภาษาไทย
 * เช่น วันเสาร์ที่ 28 ก.ย. 2567 เวลา 09:30 น.
 */
function formatThaiDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return (
      date.toLocaleDateString("th-TH", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " น."
    );
  } catch {
    return dateString;
  }
}

/**
 * ฟังก์ชันจัดรูปแบบวันที่เป็นภาษาไทย (เฉพาะวันที่)
 */
function formatThaiDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * ฟังก์ชันแปลงชื่อ Role เป็นข้อความภาษาไทย
 */
function getRoleLabel(role: string): string {
  switch (role) {
    case "companion":
      return "ผู้ช่วยร่วมเดินทาง";
    case "admin":
      return "ผู้ดูแลระบบ";
    case "customer":
    default:
      return "ผู้ใช้บริการ";
  }
}

/**
 * ฟังก์ชันกำหนดสี Badge สำหรับ Role แต่ละประเภท
 */
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "companion":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "admin":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "customer":
    default:
      return "bg-sky-100 text-sky-800 border-sky-200";
  }
}

/**
 * ฟังก์ชันกำหนดป้ายสถานะคำขอรับบริการ (Badge) พร้อมสีที่สื่อความหมาย
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
 * ฟังก์ชันแปลงรหัสผลสำเร็จเป็นข้อความภาษาไทย
 */
function getSuccessMessage(success?: string): string | null {
  if (success === "role_updated") return "อัปเดตสิทธิ์ผู้ใช้งาน (Role) เรียบร้อยแล้ว";
  if (success === "role_updated_in_progress") {
    return "อัปเดตสิทธิ์เรียบร้อยแล้ว แต่ผู้ใช้นี้ยังมีงานที่กำลังดำเนินการ (in_progress) อยู่ กรุณาตรวจสอบในรายการคำขอทั้งหมด";
  }
  return null;
}

/**
 * ฟังก์ชันแปลงรหัสข้อผิดพลาดเป็นข้อความภาษาไทย
 */
function getErrorMessage(error?: string): string | null {
  if (error === "self_demote") {
    return "ไม่สามารถลดสิทธิ์บัญชีผู้ดูแลระบบของตนเองได้ เพื่อความปลอดภัยของระบบ";
  }
  if (error === "invalid_role") {
    return "ข้อมูลสิทธิ์ผู้ใช้งานไม่ถูกต้อง กรุณาเลือกใหม่อีกครั้ง";
  }
  if (error === "update_failed") {
    return "เกิดข้อผิดพลาดในการอัปเดตสิทธิ์ผู้ใช้ กรุณาลองใหม่อีกครั้ง";
  }
  return null;
}

/**
 * หน้า Admin Dashboard สำหรับผู้ดูแลระบบ (Server Component)
 * 1. ตรวจสอบสิทธิ์ Server-side: ผู้ใช้ต้องล็อกอินและมี role === 'admin' เท่านั้น
 * 2. แสดง Overview Statistics Cards สรุปผู้ใช้และคำขอ
 * 3. แสดงตารางจัดการผู้ใช้งาน พร้อมปุ่มเปลี่ยน Role
 * 4. แสดงตารางคำขอรับบริการทั้งหมดในระบบ
 */
export default async function AdminDashboardPage({
  searchParams,
}: Readonly<AdminPageProps>) {
  // สร้าง Supabase Client ฝั่ง Server
  const supabase = await createClient();

  // 1. ตรวจสอบการเข้าสู่ระบบ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // หากไม่ได้ล็อกอิน ให้ Redirect กลับหน้าแรกทันที
  if (!user) {
    redirect("/");
  }

  // 2. ตรวจสอบสิทธิ์ว่ามี role === 'admin' ในตาราง public.profiles หรือไม่
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // หากไม่ใช่ admin ให้ Redirect กลับหน้าแรกทันที
  if (currentProfile?.role !== "admin") {
    redirect("/");
  }

  // อ่าน Query Parameters สำหรับแสดง Alert
  const { success, error } = await searchParams;
  const successMessage = getSuccessMessage(success);
  const errorMessage = getErrorMessage(error);

  // 3. ดึงรายชื่อผู้ใช้งานทั้งหมดจากตาราง public.profiles
  const { data: rawProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, phone, role, created_at")
    .order("created_at", { ascending: false });

  const profiles: ProfileRow[] = (rawProfiles as ProfileRow[]) || [];

  // 4. ดึงคำขอรับบริการทั้งหมดในระบบจากตาราง public.service_requests
  const { data: rawRequests } = await supabase
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
      ),
      companion:companion_id (
        id,
        full_name,
        avatar_url,
        phone
      )
    `)
    .order("created_at", { ascending: false });

  const requests: ServiceRequestRow[] = (rawRequests as ServiceRequestRow[]) || [];

  // คำนวณสถิติภาพรวมของผู้ใช้งาน
  const totalUsers = profiles.length;
  const customerCount = profiles.filter((p) => p.role === "customer").length;
  const companionCount = profiles.filter((p) => p.role === "companion").length;
  const adminCount = profiles.filter((p) => p.role === "admin").length;

  // คำนวณสถิติภาพรวมของคำขอรับบริการ
  const totalRequests = requests.length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const acceptedRequests = requests.filter((r) => r.status === "accepted").length;
  const inProgressRequests = requests.filter((r) => r.status === "in_progress").length;
  const completedRequests = requests.filter((r) => r.status === "completed").length;
  const cancelledRequests = requests.filter((r) => r.status === "cancelled").length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      {/* ส่วนหัวของแผงผู้ดูแลระบบ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-6">
        <div>
          <div className="mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-stone-800"
            >
              ← กลับสู่หน้าหลัก
            </Link>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 border border-amber-200">
            <Shield className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
            ระบบแผงควบคุมผู้ดูแลระบบ (Admin Dashboard)
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
            บริหารจัดการแพลตฟอร์ม Care Companion
          </h1>
          <p className="mt-1 text-sm text-stone-600 sm:text-base">
            ตรวจสอบสถิติภาพรวม จัดการสิทธิ์ของผู้ใช้งาน และตรวจสอบรายการคำขอรับบริการทั้งหมดในระบบ
          </p>
        </div>

        {/* ข้อมูลแอดมินที่กำลังใช้งาน */}
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-left text-xs leading-tight">
            <p className="font-semibold text-stone-900">
              {currentProfile?.full_name || "ผู้ดูแลระบบ"}
            </p>
            <p className="mt-0.5 text-stone-500">สิทธิ์: ผู้ดูแลระบบสูงสุด</p>
          </div>
        </div>
      </div>

      {/* ข้อความย้ำเตือนขอบเขตธุรกิจของแพลตฟอร์ม */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950 shadow-xs">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="text-xs sm:text-sm leading-6">
          <strong className="font-semibold">ข้อตกลงและขอบเขตทางธุรกิจ:</strong>{" "}
          แพลตฟอร์ม Care Companion ให้บริการช่วยเหลือการเดินทางและอำนวยความสะดวกในการทำธุระเท่านั้น
          <strong className="text-amber-900"> ไม่ใช่บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วย</strong>
        </div>
      </div>

      {/* กล่องแจ้งเตือนความสำเร็จ (Success Alert) */}
      {successMessage && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* กล่องแจ้งเตือนข้อผิดพลาด (Error Alert) */}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
          <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ส่วนแสดงภาพรวมสถิติ (Overview Statistics Cards) */}
      {/* ========================================================================= */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            ภาพรวมสถิติระบบ (Platform Overview)
          </h2>
          <p className="text-xs text-stone-500">
            ตัวเลขข้อมูลผู้ใช้งานและสถานะการดำเนินงานของคำขอรับบริการทั้งหมดในระบบ
          </p>
        </div>

        {/* ชุดการ์ดสถิติกลุ่มผู้ใช้งาน */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* การ์ด: ผู้ใช้งานทั้งหมด */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">ผู้ใช้งานทั้งหมด</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-stone-900">{totalUsers}</p>
            <p className="mt-1 text-xs text-stone-500">บัญชีผู้ใช้ในระบบทั้งหมด</p>
          </div>

          {/* การ์ด: ผู้ใช้บริการ (Customer) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">ผู้ใช้บริการ (Customer)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <UserCheck className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-sky-700">{customerCount}</p>
            <p className="mt-1 text-xs text-stone-500">
              คิดเป็น {totalUsers > 0 ? Math.round((customerCount / totalUsers) * 100) : 0}% ของผู้ใช้ทั้งหมด
            </p>
          </div>

          {/* การ์ด: ผู้ช่วยร่วมเดินทาง (Companion) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">ผู้ช่วยร่วมเดินทาง (Companion)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <HeartHandshake className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-teal-700">{companionCount}</p>
            <p className="mt-1 text-xs text-stone-500">
              ผู้ช่วยที่พร้อมส่งมอบความช่วยเหลือ
            </p>
          </div>

          {/* การ์ด: ผู้ดูแลระบบ (Admin) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">ผู้ดูแลระบบ (Admin)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Shield className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-amber-700">{adminCount}</p>
            <p className="mt-1 text-xs text-stone-500">บัญชีสิทธิ์แอดมินบริหารระบบ</p>
          </div>
        </div>

        {/* ชุดการ์ดสถิติคำขอรับบริการ */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* คำขอทั้งหมด */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">คำขอรับบริการทั้งหมด</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-stone-900">{totalRequests}</p>
            <p className="mt-1 text-xs text-stone-500">
              ยกเลิกแล้ว {cancelledRequests} รายการ
            </p>
          </div>

          {/* รอผู้ช่วยตอบรับ (Pending) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">รอผู้ช่วยตอบรับ (Pending)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-amber-800">{pendingRequests}</p>
            <p className="mt-1 text-xs text-amber-700">
              {acceptedRequests > 0 ? `ตอบรับแล้ว ${acceptedRequests} รายการ` : "คำขอใหม่ที่ยังไม่มีผู้รับ"}
            </p>
          </div>

          {/* กำลังเดินทาง / ให้บริการ (In Progress) */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-900">กำลังเดินทาง (In Progress)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800">
                <Navigation className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-indigo-800">{inProgressRequests}</p>
            <p className="mt-1 text-xs text-indigo-700">อยู่ระหว่างเดินทางหรือทำธุระ</p>
          </div>

          {/* สิ้นสุดบริการเรียบร้อย (Completed) */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900">เสร็จสิ้นบริการ (Completed)</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-emerald-800">{completedRequests}</p>
            <p className="mt-1 text-xs text-emerald-700">ภารกิจสำเร็จสมบูรณ์</p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. ส่วนตารางจัดการผู้ใช้งาน (User Management) */}
      {/* ========================================================================= */}
      <section className="mt-12">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              จัดการข้อมูลผู้ใช้งานในระบบ (User Management)
            </h2>
            <p className="text-xs text-stone-500">
              รายชื่อผู้ใช้ทั้งหมด {profiles.length} ท่าน — สามารถปรับเปลี่ยนสิทธิ์ระหว่าง Customer, Companion และ Admin ได้ทันที
            </p>
          </div>
        </div>

        {/* ตารางแสดงข้อมูลผู้ใช้ */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    ผู้ใช้งาน
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    เบอร์โทรศัพท์
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Role ปัจจุบัน
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    วันที่สมัคร
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-center">
                    การจัดการสิทธิ์ (Change Role)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-stone-500">
                      ไม่พบข้อมูลผู้ใช้งานในระบบ
                    </td>
                  </tr>
                ) : (
                  profiles.map((p) => {
                    const isCurrentUser = p.id === user.id;
                    const userName = p.full_name || "ผู้ใช้งาน Care Companion";

                    return (
                      <tr key={p.id} className="transition hover:bg-stone-50/70">
                        {/* 1. รูป Avatar และชื่อผู้ใช้ */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {p.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.avatar_url}
                                alt={userName}
                                className="h-10 w-10 shrink-0 rounded-full border border-stone-200 object-cover shadow-2xs"
                                width={40}
                                height={40}
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
                                {userName.slice(0, 1)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 truncate">
                                {userName}
                                {isCurrentUser && (
                                  <span className="ml-2 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                                    (คุณ)
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-stone-400 font-mono truncate">
                                ID: {p.id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. เบอร์โทรศัพท์ */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {p.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-stone-700">
                              <Phone className="h-3.5 w-3.5 text-teal-600" />
                              {p.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-400">-</span>
                          )}
                        </td>

                        {/* 3. Role ปัจจุบัน */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoleBadgeClass(
                              p.role,
                            )}`}
                          >
                            {getRoleLabel(p.role)}
                          </span>
                        </td>

                        {/* 4. วันที่สมัคร */}
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-stone-500">
                          {formatThaiDate(p.created_at)}
                        </td>

                        {/* 5. ปุ่มและฟอร์มเปลี่ยน Role */}
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <form
                            action={updateUserRole}
                            className="inline-flex items-center gap-2"
                          >
                            <input type="hidden" name="user_id" value={p.id} />
                            <select
                              name="new_role"
                              defaultValue={p.role}
                              aria-label={`เปลี่ยนสิทธิ์ของ ${userName}`}
                              disabled={isCurrentUser}
                              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-stone-100 disabled:text-stone-400"
                            >
                              <option value="customer">Customer (ผู้ใช้บริการ)</option>
                              <option value="companion">Companion (ผู้ช่วย)</option>
                              <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                            </select>

                            <button
                              type="submit"
                              disabled={isCurrentUser}
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                              title={
                                isCurrentUser
                                  ? "ไม่สามารถเปลี่ยนสิทธิ์บัญชีตนเองได้"
                                  : "บันทึกการเปลี่ยนสิทธิ์"
                              }
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>บันทึก</span>
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ส่วนตารางรายการคำขอรับบริการทั้งหมด (Platform Requests Overview) */}
      {/* ========================================================================= */}
      <section className="mt-12">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              รายการคำขอรับบริการทั้งหมดในระบบ (Platform Requests Overview)
            </h2>
            <p className="text-xs text-stone-500">
              ตรวจสอบทุกคำขอรับบริการ ({requests.length} รายการ) พร้อมสถานะและผู้เกี่ยวข้อง
            </p>
          </div>
        </div>

        {/* ตารางแสดงคำขอรับบริการ */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    เวลานัดหมาย / สร้างเมื่อ
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    ประเภทธุระ & เวลา
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    เส้นทาง (ต้นทาง ➔ ปลายทาง)
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    ผู้ขอรับบริการ (Customer)
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    ผู้ช่วยที่รับงาน (Companion)
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-center">
                    สถานะปัจจุบัน
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-stone-500">
                      ยังไม่มีรายการคำขอรับบริการในระบบ
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => {
                    const customerProfile = extractProfile(req.customer);
                    const customerName = customerProfile?.full_name || "ผู้ใช้บริการ";
                    const companionProfile = extractProfile(req.companion);
                    const companionName = companionProfile?.full_name;
                    const statusBadge = getStatusBadge(req.status);

                    return (
                      <tr key={req.id} className="transition hover:bg-stone-50/70">
                        {/* 1. เวลานัดหมาย */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                            <Calendar className="h-3.5 w-3.5 text-sky-600" />
                            <span>{formatThaiDateTime(req.appointment_date)}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-400">
                            ส่งคำขอ: {formatThaiDate(req.created_at)}
                          </p>
                        </td>

                        {/* 2. ประเภทธุระและระยะเวลา */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                            {req.task_type}
                          </span>
                          <p className="mt-1 text-[11px] text-stone-500">
                            ประมาณ {req.duration_hours} ชั่วโมง
                          </p>
                        </td>

                        {/* 3. ต้นทาง - ปลายทาง */}
                        <td className="px-5 py-4">
                          <div className="min-w-44 text-xs">
                            <div className="flex items-center gap-1 text-stone-700">
                              <MapPin className="h-3 w-3 text-teal-600 shrink-0" />
                              <span className="truncate max-w-48 font-medium">
                                {req.origin}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-stone-700">
                              <ArrowRight className="h-3 w-3 text-rose-500 shrink-0" />
                              <span className="truncate max-w-48 font-medium">
                                {req.destination}
                              </span>
                            </div>
                            {req.notes && (
                              <p className="mt-1.5 text-[11px] text-stone-500 line-clamp-1 italic">
                                &ldquo;{req.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 4. ผู้ขอรับบริการ (Customer) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {customerProfile?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={customerProfile.avatar_url}
                                alt={customerName}
                                className="h-7 w-7 rounded-full border border-stone-200 object-cover"
                                width={28}
                                height={28}
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                                {customerName.slice(0, 1)}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-stone-800">
                                {customerName}
                              </p>
                              {customerProfile?.phone && (
                                <p className="text-[11px] text-stone-500">
                                  {customerProfile.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 5. ผู้ช่วยที่รับงาน (Companion) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {companionProfile && companionName ? (
                            <div className="flex items-center gap-2">
                              {companionProfile.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={companionProfile.avatar_url}
                                  alt={companionName}
                                  className="h-7 w-7 rounded-full border border-stone-200 object-cover"
                                  width={28}
                                  height={28}
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                                  {companionName.slice(0, 1)}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-stone-800">
                                  {companionName}
                                </p>
                                {companionProfile.phone && (
                                  <p className="text-[11px] text-stone-500">
                                    {companionProfile.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                              <Clock className="h-3 w-3 text-stone-400" />
                              รอผู้ช่วยตอบรับ
                            </span>
                          )}
                        </td>

                        {/* 6. สถานะปัจจุบัน */}
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotColor} ${
                                req.status === "in_progress" || req.status === "pending"
                                  ? "animate-pulse"
                                  : ""
                              }`}
                            />
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
