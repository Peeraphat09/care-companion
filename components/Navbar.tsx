import Link from "next/link";
import Image from "next/image";
import { HeartHandshake, Search, ClipboardList, Shield } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";

// นิยามประเภทของสิทธิ์ผู้ใช้งานในระบบ
type UserRole = "customer" | "companion" | "admin";

/**
 * ฟังก์ชันแปลงชื่อ Role เป็นข้อความภาษาไทยสำหรับแสดงบน Badge
 */
function getRoleLabel(role: string) {
  if (role === "companion") return "ผู้ช่วยร่วมเดินทาง";
  if (role === "admin") return "ผู้ดูแลระบบ";
  return "ผู้ใช้บริการ";
}

/**
 * ฟังก์ชันกำหนดสีพื้นหลังและสีตัวอักษรของ Badge ตามสิทธิ์ของผู้ใช้
 */
function getRoleBadgeClass(role: string) {
  if (role === "companion") return "bg-teal-100 text-teal-800 border-teal-200";
  if (role === "admin") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-sky-100 text-sky-800 border-sky-200";
}

/**
 * คอมโพเนนต์แถบเมนูด้านบน (Server Component)
 * ตรวจสอบสถานะการเข้าสู่ระบบจาก Server ผ่าน Cookies
 * แสดงลิงก์นำทาง: หน้าแรก, ค้นหาผู้ช่วย (/companions), รายการคำขอของฉัน (/my-requests)
 * สำหรับ Admin: แสดงลิงก์ไปยังแผงผู้ดูแลระบบ (/admin)
 * และแสดงข้อมูลโปรไฟล์, สิทธิ์ (Role)
 */
export default async function Navbar() {
  // สร้าง Supabase Client ฝั่ง Server เพื่ออ่านข้อมูลคุกกี้ Session
  const supabase = await createClient();

  // ดึงข้อมูลผู้ใช้ปัจจุบัน (ตรวจสอบ Token จาก Server-side อย่างปลอดภัย)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = "";
  let avatarUrl: string | null = null;
  let role: UserRole = "customer";

  // หากผู้ใช้เข้าสู่ระบบแล้ว ให้ดึงข้อมูลโปรไฟล์จากตาราง public.profiles
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();

    // กำหนดชื่อและรูปภาพโปรไฟล์ (fallback เป็นค่าจาก Google metadata หากในตารางยังไม่มี)
    fullName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "ผู้ใช้ Care Companion";

    avatarUrl =
      profile?.avatar_url ||
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    role = (profile?.role as UserRole) || "customer";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        {/* ฝั่งซ้าย: โลโก้และชื่อระบบ */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-stone-800 no-underline transition hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-stone-900">
              Care Companion
            </span>
          </Link>

          {/* ลิงก์นำทางหลัก (แสดงบนหน้าจอขนาดกลางขึ้นไป) */}
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-teal-700"
            >
              หน้าแรก
            </Link>
            <Link
              href="/companions"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-teal-700"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>ค้นหาผู้ช่วย</span>
            </Link>
            {user && (
              <Link
                href="/my-requests"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-teal-700"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                <span>รายการคำขอของฉัน</span>
              </Link>
            )}
            {/* หากผู้ใช้เป็นแอดมิน แสดงลิงก์ไปยังแผงผู้ดูแลระบบ */}
            {user && role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 border border-amber-200 transition hover:bg-amber-100"
              >
                <Shield className="h-4 w-4 text-amber-700" aria-hidden="true" />
                <span>แผงผู้ดูแลระบบ</span>
              </Link>
            )}
          </div>
        </div>

        {/* ส่วนควบคุมและเมนูด้านขวา */}
        <div className="flex items-center gap-3">
          {/* ลิงก์ค้นหาผู้ช่วย (แสดงบนหน้าจอเล็ก) */}
          <Link
            href="/companions"
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-teal-700 md:hidden"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>หาผู้ช่วย</span>
          </Link>

          {/* ลิงก์คำขอของฉัน (แสดงบนหน้าจอเล็กเมื่อล็อกอิน) */}
          {user && (
            <Link
              href="/my-requests"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-teal-700 md:hidden"
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              <span>คำขอของฉัน</span>
            </Link>
          )}

          {/* ลิงก์แผงผู้ดูแลระบบ (แสดงบนหน้าจอเล็กเมื่อเป็น admin) */}
          {user && role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 border border-amber-200 md:hidden"
            >
              <Shield className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              <span>แผงผู้ดูแล</span>
            </Link>
          )}

          {/* ตรวจสอบสถานะการเข้าสู่ระบบ */}
          {!user ? (
            /* กรณีที่ 1: ยังไม่ได้เข้าสู่ระบบ ให้แสดงปุ่ม LoginButton */
            <LoginButton />
          ) : (
            /* กรณีที่ 2: เข้าสู่ระบบแล้ว */
            <>
              {/* หากเป็น 'customer' ให้แสดงปุ่ม/ลิงก์ "สมัครเป็นผู้ช่วยร่วมเดินทาง" */}
              {role === "customer" && (
                <Link
                  href="/become-companion"
                  className="rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-teal-700 sm:text-sm"
                >
                  <span className="sm:hidden">สมัครเป็นผู้ช่วย</span>
                  <span className="hidden sm:inline">
                    สมัครเป็นผู้ช่วยร่วมเดินทาง
                  </span>
                </Link>
              )}

              {/* ข้อมูลโปรไฟล์ผู้ใช้: แสดง Avatar, ชื่อ และ Badge ระบุ Role */}
              {/* กดที่รูป/ชื่อเพื่อไปหน้าแก้ไขโปรไฟล์ */}
              <Link
                href="/profile"
                aria-label="แก้ไขโปรไฟล์ของฉัน"
                className="flex items-center gap-2.5 rounded-lg transition hover:opacity-80"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`รูปโปรไฟล์ของ ${fullName}`}
                    className="h-9 w-9 rounded-full border border-stone-200 object-cover shadow-sm"
                    width={36}
                    height={36}
                    unoptimized={avatarUrl.startsWith('http')}
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                    {fullName.slice(0, 1)}
                  </span>
                )}

                {/* แสดงชื่อและ Role Badge */}
                <div className="hidden leading-tight sm:block">
                  <p className="max-w-40 truncate text-sm font-medium text-stone-800">
                    {fullName}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${getRoleBadgeClass(
                      role,
                    )}`}
                  >
                    {getRoleLabel(role)}
                  </span>
                </div>
              </Link>

              {/* ปุ่มออกจากระบบ */}
              <LogoutButton />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
