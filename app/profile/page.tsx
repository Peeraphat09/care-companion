import Image from "next/image";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { updateProfile } from "./actions";

// กำหนด Type ของพารามิเตอร์ URL ในหน้าโปรไฟล์
type ProfilePageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

// คลาส Tailwind ของช่องกรอกข้อมูล (ใช้ซ้ำทุกช่อง)
const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2";

/**
 * ฟังก์ชันแปลงรหัสข้อผิดพลาดเป็นข้อความภาษาไทย
 */
function getErrorMessage(error?: string) {
  if (error === "invalid_name") return "กรุณากรอกชื่อ (ไม่เกิน 100 ตัวอักษร)";
  if (error === "invalid_phone") return "เบอร์โทรไม่ถูกต้อง กรุณากรอกตัวเลข 9-15 หลัก (ใช้ + หรือ - ได้)";
  if (error === "invalid_image_type") return "รองรับเฉพาะไฟล์รูปนามสกุล JPG, PNG หรือ WebP";
  if (error === "image_too_large") return "ไฟล์รูปมีขนาดใหญ่เกิน 2MB กรุณาเลือกรูปที่เล็กลง";
  if (error === "upload_failed") return "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  if (error === "incomplete_companion") return "กรุณากรอกข้อมูลผู้ช่วยให้ครบทุกช่อง";
  if (error === "profile_not_found") return "ไม่พบข้อมูลโปรไฟล์ของคุณ";
  if (error === "save_failed") return "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  return null;
}

/**
 * หน้าแก้ไขโปรไฟล์ (Server Component) สำหรับผู้ใช้ทุก role
 * - ทุก role: ชื่อ, เบอร์โทร, รูปโปรไฟล์ (อัปโหลดขึ้น Supabase Storage)
 * - เฉพาะ Companion: ประวัติย่อ, ทักษะ, พื้นที่, วันเวลาที่สะดวก และสวิตช์เปิดรับงาน
 */
export default async function ProfilePage({ searchParams }: Readonly<ProfilePageProps>) {
  const supabase = await createClient();
  const { error, success } = await searchParams;

  // บังคับล็อกอิน
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // ดึงข้อมูลโปรไฟล์ปัจจุบัน
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/");
  }

  // ถ้าเป็น Companion ดึงข้อมูลผู้ช่วยเพิ่ม
  const isCompanion = profile.role === "companion";
  const { data: companion } = isCompanion
    ? await supabase
        .from("companion_profiles")
        .select("bio, skills, service_areas, available_days, is_available")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const errorMessage = getErrorMessage(error);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">แก้ไขโปรไฟล์ของฉัน</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        ปรับปรุงชื่อ รูปโปรไฟล์ และข้อมูลติดต่อของคุณ เบอร์โทรจะแสดงให้อีกฝ่ายเห็นเฉพาะหลังจากมีผู้ตอบรับงานร่วมกันแล้วเท่านั้น
      </p>

      {/* ข้อความแจ้งผลสำเร็จ / ข้อผิดพลาด */}
      {success === "saved" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>บันทึกโปรไฟล์เรียบร้อยแล้ว</p>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* แบบฟอร์ม: ส่งเป็น multipart อัตโนมัติเมื่อใช้ Server Action ที่มี input file */}
      <form action={updateProfile} className="mt-8 space-y-6">
        {/* รูปโปรไฟล์ */}
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={`รูปโปรไฟล์ของ ${profile.full_name}`}
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full border border-stone-200 object-cover shadow-sm"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-2xl font-semibold text-teal-800">
              {profile.full_name.slice(0, 1)}
            </span>
          )}
          <div className="flex-1">
            <label htmlFor="avatar" className="mb-1.5 block text-sm font-medium text-stone-800">
              เปลี่ยนรูปโปรไฟล์
            </label>
            <input
              id="avatar"
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
            />
            <p className="mt-1 text-xs text-stone-500">ไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 2MB</p>
          </div>
        </div>

        {/* ชื่อ */}
        <div>
          <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-stone-800">
            ชื่อที่แสดง <span className="text-red-500">*</span>
          </label>
          <input
            id="full_name"
            type="text"
            name="full_name"
            required
            maxLength={100}
            defaultValue={profile.full_name}
            className={inputClass}
          />
        </div>

        {/* เบอร์โทร */}
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-stone-800">
            เบอร์โทรศัพท์
          </label>
          <input
            id="phone"
            type="tel"
            name="phone"
            defaultValue={profile.phone ?? ""}
            placeholder="เช่น 081-234-5678"
            className={inputClass}
          />
        </div>

        {/* ส่วนของ Companion */}
        {isCompanion && (
          <section className="space-y-6 border-t border-stone-200 pt-6">
            <h2 className="text-lg font-bold text-stone-900">ข้อมูลผู้ช่วยร่วมเดินทาง</h2>

            {/* ข้อความย้ำเตือนขอบเขตธุรกิจ: ไม่ใช่บริการทางการแพทย์ */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-sm leading-6">
                <strong className="font-semibold">ข้อตกลงสำคัญ:</strong> ผู้ช่วยร่วมเดินทางมีหน้าที่ช่วยเหลือการเดินทางและทำธุระเท่านั้น
                ไม่ใช่บริการทางการแพทย์และไม่ใช่ผู้ดูแลรักษาผู้ป่วย
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                name="is_available"
                defaultChecked={companion?.is_available ?? true}
                className="h-5 w-5 accent-teal-600"
              />
              <span className="text-sm font-medium text-stone-800">
                เปิดรับงาน (แสดงชื่อในหน้าค้นหาผู้ช่วยและรับคำขอเจาะจงได้)
              </span>
            </label>

            <div>
              <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-stone-800">
                ประวัติย่อและการแนะนำตัว <span className="text-red-500">*</span>
              </label>
              <textarea id="bio" name="bio" required rows={4} defaultValue={companion?.bio ?? ""} className={inputClass} />
            </div>

            <div>
              <label htmlFor="skills" className="mb-1.5 block text-sm font-medium text-stone-800">
                ทักษะและความสามารถพิเศษ <span className="text-red-500">*</span>
              </label>
              <textarea id="skills" name="skills" required rows={3} defaultValue={companion?.skills ?? ""} className={inputClass} />
              <p className="mt-1 text-xs text-stone-500">ระบุทักษะการช่วยเหลือการเดินทาง (ไม่เกี่ยวข้องกับหัตถการทางการแพทย์)</p>
            </div>

            <div>
              <label htmlFor="service_areas" className="mb-1.5 block text-sm font-medium text-stone-800">
                พื้นที่ที่สะดวกให้บริการ <span className="text-red-500">*</span>
              </label>
              <input
                id="service_areas"
                type="text"
                name="service_areas"
                required
                defaultValue={companion?.service_areas ?? ""}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="available_days" className="mb-1.5 block text-sm font-medium text-stone-800">
                ช่วงวันและเวลาที่สะดวกให้บริการ <span className="text-red-500">*</span>
              </label>
              <input
                id="available_days"
                type="text"
                name="available_days"
                required
                defaultValue={companion?.available_days ?? ""}
                className={inputClass}
              />
            </div>
          </section>
        )}

        <div className="pt-2">
          <SubmitButton defaultText="บันทึกโปรไฟล์" loadingText="กำลังบันทึก..." />
        </div>
      </form>
    </main>
  );
}
