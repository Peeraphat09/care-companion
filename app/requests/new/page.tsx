import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  HeartHandshake,
  User,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { createServiceRequest } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

// กำหนด Type ของพารามิเตอร์ URL ในหน้าสร้างคำขอ
type NewRequestPageProps = {
  searchParams: Promise<{
    companion_id?: string;
    error?: string;
    reason?: string;
  }>;
};

/**
 * ฟังก์ชันแปลงรหัสข้อผิดพลาดเป็นข้อความภาษาไทยที่เข้าใจง่าย
 */
function getErrorMessage(error?: string, reason?: string) {
  if (error === "incomplete") {
    return "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนทุกช่อง (ประเภทธุระ, ต้นทาง, ปลายทาง, วันเวลานัดหมาย และระยะเวลา)";
  }
  if (error === "invalid_date") {
    return "วันและเวลานัดหมายไม่ถูกต้อง กรุณาเลือกวันและเวลาใหม่อีกครั้ง";
  }
  if (error === "past_date") {
    return "ไม่สามารถจองวันและเวลาย้อนหลังได้ กรุณาเลือกเวลาในอนาคต";
  }
  if (error === "invalid_duration") {
    return "ระยะเวลาโดยประมาณต้องเป็นตัวเลขจำนวนเต็มชั่วโมง ตั้งแต่ 1 ถึง 24 ชั่วโมง";
  }
  if (error === "invalid_companion") {
    return "ผู้ช่วยที่เลือกไม่พร้อมรับงานหรือไม่มีอยู่ในระบบ กรุณาเลือกผู้ช่วยใหม่ หรือสร้างเป็นคำขอแบบเปิด";
  }
  if (error === "save") {
    return `เกิดข้อผิดพลาดในการบันทึกคำขอรับบริการ: ${reason || "กรุณาลองใหม่อีกครั้ง"}`;
  }
  return null;
}

/**
 * หน้าสร้างคำขอรับบริการใหม่ (Server Component)
 * - บังคับให้ผู้ใช้ต้องเข้าสู่ระบบก่อน หากยังไม่ล็อกอินจะ redirect ไปหน้าแรก
 * - รองรับการระบุ companion_id จาก Query Param เพื่อส่งคำขอให้ผู้ช่วยคนนั้นโดยเฉพาะ
 * - แสดงฟอร์มกรอกข้อมูลตามสคีมา public.service_requests ครบทุกฟิลด์
 * - มีข้อความย้ำเตือนขอบเขตธุรกิจอย่างเข้มงวด
 */
export default async function NewRequestPage({
  searchParams,
}: Readonly<NewRequestPageProps>) {
  // สร้าง Supabase Client สำหรับฝั่ง Server
  const supabase = await createClient();

  // ตรวจสอบการเข้าสู่ระบบ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // หากยังไม่ได้เข้าสู่ระบบ ให้ redirect ไปหน้าแรกทันทีตามข้อกำหนด
  if (!user) {
    redirect("/");
  }

  // อนุญาตเฉพาะ Customer (Companion/Admin ไม่สร้างคำขอ) — ตรวจก่อน render ฟอร์ม
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (currentProfile?.role !== "customer") {
    redirect("/my-requests?error=customer_only");
  }

  // ดึงค่า Query Parameters
  const { companion_id, error, reason } = await searchParams;
  const errorMessage = getErrorMessage(error, reason);

  // หากมีการส่ง companion_id มา ให้ดึงข้อมูลของผู้ช่วยคนนั้นเพื่อแสดงสรุปบนฟอร์ม
  let selectedCompanion: {
    id: string;
    bio: string | null;
    service_areas: string | null;
    skills: string | null;
    full_name: string;
    avatar_url: string | null;
  } | null = null;

  if (companion_id) {
    const { data: companionData } = await supabase
      .from("companion_profiles")
      .select(`
        id,
        bio,
        service_areas,
        skills,
        profiles!inner (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq("id", companion_id)
      .eq("is_available", true)
      .eq("profiles.role", "companion")
      .neq("id", user.id)
      .maybeSingle();

    if (companionData) {
      const rawProfile = companionData.profiles;
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
      selectedCompanion = {
        id: companionData.id,
        bio: companionData.bio,
        service_areas: companionData.service_areas,
        skills: companionData.skills,
        full_name: profile?.full_name || "ผู้ช่วยร่วมเดินทาง",
        avatar_url: profile?.avatar_url || null,
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      {/* ลิงก์ย้อนกลับ */}
      <div className="mb-6">
        <Link
          href={selectedCompanion ? "/companions" : "/"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>ย้อนกลับ</span>
        </Link>
      </div>

      {/* ส่วนหัวของหน้า */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          <HeartHandshake className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          บริการขอผู้ช่วยร่วมเดินทาง
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          สร้างคำขอรับบริการใหม่
        </h1>
        <p className="mt-1 text-sm text-stone-600 sm:text-base">
          กรอกรายละเอียดการเดินทางและธุระของคุณ เพื่อให้ผู้ช่วยร่วมเดินทางเตรียมตัวดูแลคุณได้อย่างถูกต้อง
        </p>
      </div>

      {/* กล่องข้อความแจ้งเตือนขอบเขตบริการที่เข้มงวด (Strict Business Boundary) */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="text-sm leading-6">
          <strong className="font-semibold">ข้อตกลงและขอบเขตหน้าที่สำคัญ:</strong>{" "}
          ผู้ช่วยร่วมเดินทางมีหน้าที่ช่วยเหลือการเดินทางและอำนวยความสะดวกในการทำธุระเท่านั้น
          <strong className="text-amber-950"> ไม่ใช่บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วยโดยเด็ดขาด</strong>
        </div>
      </div>

      {/* กล่องแสดงข้อความเตือนเมื่อเกิด Error */}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* กล่องสรุปสถานะผู้ช่วยที่เลือก (ถ้ามี) */}
      <div className="mt-6">
        {selectedCompanion ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                คุณกำลังสร้างคำขอเจาะจงถึงผู้ช่วย
              </span>
              <Link
                href="/requests/new"
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>เปลี่ยนเป็นคำขอทั่วไป</span>
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-3.5">
              {selectedCompanion.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedCompanion.avatar_url}
                  alt={`รูปโปรไฟล์ของ ${selectedCompanion.full_name}`}
                  className="h-12 w-12 rounded-full border border-teal-200 object-cover"
                  width={48}
                  height={48}
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-base font-bold text-white">
                  {selectedCompanion.full_name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold text-stone-900">{selectedCompanion.full_name}</p>
                {selectedCompanion.service_areas && (
                  <p className="text-xs text-stone-600">
                    พื้นที่: {selectedCompanion.service_areas}
                  </p>
                )}
                {selectedCompanion.skills && (
                  <p className="truncate text-xs text-stone-500">
                    ทักษะ: {selectedCompanion.skills}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-xs text-stone-600 sm:text-sm">
            <div className="flex items-center gap-2 font-medium text-stone-800">
              <User className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <span>คำขอรับบริการแบบทั่วไป (Open Request)</span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              คำขอนี้จะเปิดให้ผู้ช่วยร่วมเดินทางที่พร้อมรับงานทุกคนสามารถเข้ามาดูและกดยืนยันตอบรับงานได้
            </p>
          </div>
        )}
      </div>

      {/* แบบฟอร์มสร้างคำขอรับบริการ */}
      <form action={createServiceRequest} className="mt-8 space-y-6">
        {/* ส่ง companion_id แบบ Hidden Input (ถ้ามี) */}
        {selectedCompanion && (
          <input type="hidden" name="companion_id" value={selectedCompanion.id} />
        )}

        {/* ช่องที่ 1: ประเภทธุระ (task_type) */}
        <div>
          <label htmlFor="task_type" className="mb-1.5 block text-sm font-semibold text-stone-800">
            ประเภทธุระที่ต้องการความช่วยเหลือ <span className="text-red-500">*</span>
          </label>
          <select
            id="task_type"
            name="task_type"
            required
            defaultValue="ไปโรงพยาบาลตามนัดแพทย์"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition focus:border-teal-600 focus:ring-2"
          >
            <option value="ไปโรงพยาบาลตามนัดแพทย์">ไปโรงพยาบาลตามนัดแพทย์ (พบแพทย์ / รับยา / ตรวจสุขภาพ)</option>
            <option value="ติดต่อธนาคาร / การเงิน">ติดต่อธนาคาร / ธุรกรรมทางการเงิน</option>
            <option value="ติดต่อหน่วยงานราชการ">ติดต่อหน่วยงานราชการ (สำนักงานเขต, ที่ว่าการอำเภอ, ประกันสังคม)</option>
            <option value="ซื้อของ / จ่ายตลาด / ซูเปอร์มาร์เก็ต">ซื้อของ / จ่ายตลาด / ซูเปอร์มาร์เก็ต</option>
            <option value="ไปทำบุญ / กิจกรรมทางศาสนา">ไปทำบุญ / กิจกรรมทางศาสนา</option>
            <option value="ธุระส่วนตัวอื่นๆ">ธุระส่วนตัวอื่นๆ</option>
          </select>
          <p className="mt-1 text-xs text-stone-500">
            เลือกประเภทธุระเพื่อให้ผู้ช่วยเข้าใจภารกิจเบื้องต้น
          </p>
        </div>

        {/* ช่องที่ 2 & 3: สถานที่ต้นทาง และ จุดหมายปลายทาง */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* ต้นทาง (origin) */}
          <div>
            <label htmlFor="origin" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
              <MapPin className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <span>สถานที่ต้นทาง (จุดนัดพบ)</span> <span className="text-red-500">*</span>
            </label>
            <input
              id="origin"
              type="text"
              name="origin"
              required
              placeholder="เช่น บ้านเลขที่ 12 ซอยพหลโยธิน 5, คอนโดลุมพินี"
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
            />
            <p className="mt-1 text-xs text-stone-500">
              ระบุจุดนัดพบที่ชัดเจนสำหรับเริ่มต้นการเดินทาง
            </p>
          </div>

          {/* ปลายทาง (destination) */}
          <div>
            <label htmlFor="destination" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
              <MapPin className="h-4 w-4 text-rose-500" aria-hidden="true" />
              <span>จุดหมายปลายทาง</span> <span className="text-red-500">*</span>
            </label>
            <input
              id="destination"
              type="text"
              name="destination"
              required
              placeholder="เช่น โรงพยาบาลรามาธิบดี ตึกสมเด็จพระเทพรัตน์"
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
            />
            <p className="mt-1 text-xs text-stone-500">
              ระบุสถานที่ปลายทางและแผนก/อาคารที่ต้องไป
            </p>
          </div>
        </div>

        {/* ช่องที่ 4 & 5: วันเวลานัดหมาย และ ระยะเวลาชั่วโมง */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* วันเวลานัดหมาย (appointment_date) */}
          <div>
            <label
              htmlFor="appointment_date"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-800"
            >
              <Calendar className="h-4 w-4 text-sky-600" aria-hidden="true" />
              <span>วันและเวลานัดหมาย</span> <span className="text-red-500">*</span>
            </label>
            <input
              id="appointment_date"
              type="datetime-local"
              name="appointment_date"
              required
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition focus:border-teal-600 focus:ring-2"
            />
            <p className="mt-1 text-xs text-stone-500">
              กำหนดวันที่และเวลาเริ่มต้นที่ต้องการให้ออกเดินทาง
            </p>
          </div>

          {/* ระยะเวลาโดยประมาณ (duration_hours) */}
          <div>
            <label
              htmlFor="duration_hours"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-800"
            >
              <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span>ระยะเวลาโดยประมาณ (ชั่วโมง)</span> <span className="text-red-500">*</span>
            </label>
            <input
              id="duration_hours"
              type="number"
              name="duration_hours"
              required
              min={1}
              max={24}
              defaultValue={3}
              placeholder="เช่น 2, 3 หรือ 4"
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition focus:border-teal-600 focus:ring-2"
            />
            <p className="mt-1 text-xs text-stone-500">
              ประเมินเวลารวมเดินทางและทำธุระ (หน่วย: ชั่วโมง)
            </p>
          </div>
        </div>

        {/* ช่องที่ 6: รายละเอียดเพิ่มเติม / ข้อควรระวัง (notes) */}
        <div>
          <label htmlFor="notes" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
            <FileText className="h-4 w-4 text-stone-600" aria-hidden="true" />
            <span>รายละเอียดเพิ่มเติม / สิ่งที่ต้องการให้ช่วยเหลือเป็นพิเศษ</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="เช่น มีวีลแชร์แบบพับได้, ต้องช่วยพยุงเดิน, ต้องการให้ช่วยถือแฟ้มเอกสารและเข้าคิว หรือช่องทางติดต่อผู้ติดตาม"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-xs outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-stone-500">
            ระบุข้อมูลที่จะช่วยให้การเดินทางเป็นไปอย่างราบรื่น (ไม่เกี่ยวข้องกับการรักษาพยาบาล)
          </p>
        </div>

        {/* ปุ่มกดยืนยันการสร้างคำขอ */}
        <div className="pt-4 border-t border-stone-200">
          <SubmitButton 
            defaultText={selectedCompanion ? `ยืนยันการส่งคำขอถึง ${selectedCompanion.full_name}` : "ยืนยันและประกาศสร้างคำขอรับบริการ"}
            loadingText="กำลังบันทึกข้อมูล..."
          />
          <p className="mt-2 text-center text-xs text-stone-500">
            เมื่อส่งคำขอแล้ว คุณสามารถตรวจสอบสถานะได้ที่หน้ารายการคำขอของฉัน
          </p>
        </div>
      </form>
    </main>
  );
}
