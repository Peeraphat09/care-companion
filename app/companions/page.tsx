import Link from "next/link";
import {
  Search,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  HeartHandshake,
  X,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";

// กำหนด Type ของพารามิเตอร์ URL ในหน้าค้นหาผู้ช่วย
type CompanionsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

// กำหนด Type ข้อมูลโปรไฟล์ทั่วไปของผู้ใช้
type ProfileData = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

// กำหนด Type ข้อมูลของผู้ช่วยร่วมเดินทาง (Companion)
type CompanionWithProfile = {
  id: string;
  bio: string | null;
  skills: string | null;
  service_areas: string | null;
  available_days: string | null;
  is_available: boolean;
  profiles: ProfileData | ProfileData[] | null;
};

/**
 * ฟังก์ชันช่วยดึงข้อมูลโปรไฟล์เดี่ยวจากฟิลด์ profiles
 * (รองรับกรณี PostgREST ส่งกลับมาเป็นอ็อบเจกต์หรืออาร์เรย์ตัวเดียว)
 */
function extractProfile(
  rawProfiles: ProfileData | ProfileData[] | null,
): ProfileData | null {
  if (!rawProfiles) return null;
  if (Array.isArray(rawProfiles)) {
    return rawProfiles.length > 0 ? rawProfiles[0] : null;
  }
  return rawProfiles;
}

/**
 * หน้าค้นหาและแสดงรายชื่อผู้ช่วยร่วมเดินทาง (Server Component)
 * - ดึงข้อมูล Companion จาก public.companion_profiles ร่วมกับ public.profiles
 * - กรองเฉพาะผู้ช่วยที่เปิดสถานะพร้อมรับงาน (is_available = true)
 * - รองรับการค้นหาตามคีย์เวิร์ด (ชื่อ, พื้นที่ให้บริการ, ทักษะ)
 * - มีปุ่มเลือกผู้ช่วยเพื่อส่งไปยังหน้าสร้างคำขอพร้อมแนบ companion_id
 */
export default async function CompanionsPage({
  searchParams,
}: Readonly<CompanionsPageProps>) {
  // ดึงค่าคำค้นหาจาก Query Parameter (เช่น /companions?q=พญาไท)
  const { q } = await searchParams;
  const searchTerm = q?.trim() || "";

  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจผู้ใช้ปัจจุบัน: หน้านี้เปิดสาธารณะ แต่ปุ่มสร้างคำขอแสดงเฉพาะ Customer (หรือผู้ที่ยังไม่ล็อกอิน)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let canCreateRequest = true;
  if (user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    canCreateRequest = me?.role === "customer";
  }

  // ดึงข้อมูลผู้ช่วยร่วมเดินทางพร้อมข้อมูลโปรไฟล์พื้นฐาน
  // กรองเฉพาะผู้ที่ยังมี role = 'companion' จริง (ถูกลดสิทธิ์แล้วต้องไม่แสดง) และไม่แสดงการ์ดของตนเอง
  let companionQuery = supabase
    .from("companion_profiles")
    .select(`
      id,
      bio,
      skills,
      service_areas,
      available_days,
      is_available,
      profiles!inner (
        id,
        full_name,
        avatar_url,
        phone
      )
    `)
    .eq("is_available", true)
    .eq("profiles.role", "companion");
  if (user) {
    companionQuery = companionQuery.neq("id", user.id);
  }
  const { data: rawCompanions, error } = await companionQuery;

  if (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล companion_profiles:", error.message);
  }

  // แปลงโครงสร้างข้อมูลให้อ่านและใช้งานได้ง่าย
  const companionsList: CompanionWithProfile[] = rawCompanions || [];

  // กรองข้อมูลตามคำค้นหา (ค้นจากชื่อ, พื้นที่ให้บริการ, ทักษะ และประวัติย่อ)
  const filteredCompanions = companionsList.filter((item) => {
    if (!searchTerm) return true;
    const profile = extractProfile(item.profiles);
    const searchLower = searchTerm.toLowerCase();

    const nameMatch = profile?.full_name?.toLowerCase().includes(searchLower);
    const areaMatch = item.service_areas?.toLowerCase().includes(searchLower);
    const skillMatch = item.skills?.toLowerCase().includes(searchLower);
    const bioMatch = item.bio?.toLowerCase().includes(searchLower);

    return Boolean(nameMatch || areaMatch || skillMatch || bioMatch);
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      {/* ส่วนหัวของหน้าและคำอธิบาย */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            <HeartHandshake className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            ผู้ช่วยร่วมเดินทางที่พร้อมให้บริการ
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            ค้นหาผู้ช่วยร่วมเดินทาง (Care Companions)
          </h1>
          <p className="mt-1 text-sm text-stone-600 sm:text-base">
            เลือกผู้ช่วยที่ตรงกับพื้นที่และวันเวลาที่คุณต้องการ เพื่อร่วมเดินทางไปทำธุระอย่างอุ่นใจ
          </p>
        </div>

        {/* ปุ่มสร้างคำขอแบบทั่วไป (ไม่ระบุผู้ช่วย) */}
        {canCreateRequest && (
          <Link
            href="/requests/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-teal-50"
          >
            <span>สร้างคำขอทั่วไป (ไม่เจาะจง)</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* ข้อความย้ำเตือนขอบเขตบริการที่เข้มงวด (Strict Business Boundary) */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="text-sm leading-6">
          <strong className="font-semibold">ข้อตกลงและขอบเขตหน้าที่สำคัญ:</strong>{" "}
          ผู้ช่วยร่วมเดินทางมีหน้าที่ช่วยเหลือการเดินทางและอำนวยความสะดวกในการทำธุระเท่านั้น
          <strong className="text-amber-950"> ไม่ใช่บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วยโดยเด็ดขาด</strong>
        </div>
      </div>

      {/* แบบฟอร์มช่องค้นหาข้อมูลผู้ช่วย */}
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <form method="GET" action="/companions" className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder="ค้นหาตามพื้นที่ (เช่น พญาไท, รถไฟฟ้า BTS), ทักษะ (เช่น เข็นวีลแชร์) หรือชื่อผู้ช่วย"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 py-2.5 pr-4 pl-10 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:flex-none"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>ค้นหา</span>
            </button>

            {searchTerm && (
              <Link
                href="/companions"
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 hover:text-stone-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>ล้างการค้นหา</span>
              </Link>
            )}
          </div>
        </form>

        {/* แท็กพื้นที่ยอดนิยมสำหรับกดค้นหาด่วน */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 text-xs text-stone-500">
          <span className="font-medium text-stone-600">คำค้นหายอดนิยม:</span>
          {["โรงพยาบาล", "วีลแชร์", "พญาไท", "แนวรถไฟฟ้า", "จตุจักร"].map((tag) => (
            <Link
              key={tag}
              href={`/companions?q=${encodeURIComponent(tag)}`}
              className="rounded-lg bg-stone-100 px-2.5 py-1 text-stone-600 transition hover:bg-teal-50 hover:text-teal-700"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      {/* ส่วนแสดงรายการการ์ดผู้ช่วยร่วมเดินทาง */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">
            {searchTerm ? (
              <>
                ผลการค้นหาสำหรับ &ldquo;<span className="text-teal-700">{searchTerm}</span>&rdquo;{" "}
                <span className="text-sm font-normal text-stone-500">
                  (พบ {filteredCompanions.length} ท่าน)
                </span>
              </>
            ) : (
              <>
                ผู้ช่วยร่วมเดินทางทั้งหมด{" "}
                <span className="text-sm font-normal text-stone-500">
                  ({filteredCompanions.length} ท่าน)
                </span>
              </>
            )}
          </h2>
        </div>

        {/* กรณีค้นหาไม่พบข้อมูล หรือยังไม่มี Companion */}
        {filteredCompanions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <Search className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-stone-800">
              {searchTerm
                ? "ไม่พบผู้ช่วยร่วมเดินทางที่ตรงกับคำค้นหา"
                : "ยังไม่มีผู้ช่วยร่วมเดินทางที่เปิดรับงานในขณะนี้"}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              {searchTerm
                ? "ลองเปลี่ยนคำค้นหาเป็นชื่อเขต หรือทักษะอื่นๆ เช่น วีลแชร์ หรือรถไฟฟ้า"
                : "คุณสามารถสร้างคำขอรับบริการแบบทั่วไปไว้ได้ เมื่อมีผู้ช่วยพร้อมจะติดต่อกลับ"}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {searchTerm && (
                <Link
                  href="/companions"
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  ดูผู้ช่วยทั้งหมด
                </Link>
              )}
              {canCreateRequest && (
                <Link
                  href="/requests/new"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
                >
                  สร้างคำขอทั่วไป
                </Link>
              )}
            </div>
          </div>
        ) : (
          /* รายการการ์ดข้อมูลผู้ช่วยร่วมเดินทาง */
          <div className="grid gap-6 md:grid-cols-2">
            {filteredCompanions.map((companion) => {
              const profile = extractProfile(companion.profiles);
              const fullName = profile?.full_name || "ผู้ช่วย Care Companion";
              const avatarUrl = profile?.avatar_url;

              return (
                <article
                  key={companion.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-teal-300 hover:shadow-md"
                >
                  <div>
                    {/* ข้อมูลโปรไฟล์ด้านบน: รูป Avatar, ชื่อ, สถานะพร้อมรับงาน */}
                    <div className="flex items-start gap-4">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={`รูปโปรไฟล์ของ ${fullName}`}
                          className="h-14 w-14 shrink-0 rounded-full border border-stone-200 object-cover shadow-xs"
                          width={56}
                          height={56}
                          unoptimized={avatarUrl.startsWith('http')}
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-800 shadow-xs">
                          {fullName.slice(0, 1)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-bold text-stone-900 sm:text-lg">
                            {fullName}
                          </h3>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            พร้อมรับงาน
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ประวัติย่อ / แนะนำตัว (bio) */}
                    {companion.bio && (
                      <p className="mt-4 text-sm leading-6 text-stone-600 line-clamp-3">
                        &ldquo;{companion.bio}&rdquo;
                      </p>
                    )}

                    {/* ข้อมูลรายละเอียด: ทักษะ, พื้นที่ให้บริการ และวันเวลาที่สะดวก */}
                    <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4 text-xs sm:text-sm">
                      {/* ทักษะและความสามารถ (skills) */}
                      {companion.skills && (
                        <div className="flex items-start gap-2 text-stone-700">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                          <div className="leading-snug">
                            <span className="font-semibold text-stone-800">ทักษะ:</span>{" "}
                            {companion.skills}
                          </div>
                        </div>
                      )}

                      {/* พื้นที่ให้บริการ (service_areas) */}
                      {companion.service_areas && (
                        <div className="flex items-start gap-2 text-stone-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                          <div className="leading-snug">
                            <span className="font-semibold text-stone-800">พื้นที่:</span>{" "}
                            {companion.service_areas}
                          </div>
                        </div>
                      )}

                      {/* วันเวลาที่สะดวก (available_days) */}
                      {companion.available_days && (
                        <div className="flex items-start gap-2 text-stone-700">
                          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
                          <div className="leading-snug">
                            <span className="font-semibold text-stone-800">เวลาสะดวก:</span>{" "}
                            {companion.available_days}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ปุ่มเลือกผู้ช่วยคนนี้ เพื่อส่งต่อไปยังหน้าสร้างคำขอ */}
                  {canCreateRequest && (
                    <div className="mt-6 pt-4 border-t border-stone-100">
                      <Link
                        href={`/requests/new?companion_id=${companion.id}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
                      >
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                        <span>เลือกผู้ช่วยคนนี้</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
