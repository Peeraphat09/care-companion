import { redirect } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import LoginButton from "@/components/LoginButton";
import { registerAsCompanion } from "./actions";

// กำหนด Type ของพารามิเตอร์ URL ในหน้าเพจ
type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * ฟังก์ชันแปลงรหัสข้อผิดพลาดเป็นข้อความภาษาไทยที่เข้าใจง่ายและสุภาพ
 */
function getErrorMessage(error?: string) {
  if (error === "incomplete") {
    return "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง เพื่อประโยชน์ในการจับคู่งาน";
  }
  if (error === "save") {
    return "ไม่สามารถบันทึกข้อมูลผู้ช่วยร่วมเดินทางได้ กรุณาลองใหม่อีกครั้ง";
  }
  if (error === "role") {
    return "เกิดข้อผิดพลาดในการอัปเดตสิทธิ์ผู้ใช้งาน กรุณาลองใหม่อีกครั้ง";
  }
  return null;
}

/**
 * หน้าลงทะเบียนเป็นผู้ช่วยร่วมเดินทาง (Server Component)
 * ตรวจสอบสิทธิ์ผู้ใช้ และแสดงแบบฟอร์มข้อมูล Companion
 */
export default async function BecomeCompanionPage({
  searchParams,
}: Readonly<PageProps>) {
  // สร้าง Supabase Client ฝั่ง Server เพื่อดึง Session ผู้ใช้
  const supabase = await createClient();
  const { error } = await searchParams;

  // ตรวจสอบการเข้าสู่ระบบ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // กรณีที่ 1: หากยังไม่ได้เข้าสู่ระบบ ให้แสดงข้อความเตือนพร้อมปุ่มล็อกอิน
  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-stone-900">
            กรุณาเข้าสู่ระบบก่อนสมัคร
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            คุณจำเป็นต้องเข้าสู่ระบบด้วยบัญชี Google
            เพื่อเริ่มต้นลงทะเบียนเป็นผู้ช่วยร่วมเดินทางในระบบ
          </p>
          <div className="mt-6 flex justify-center">
            <LoginButton />
          </div>
        </div>
      </main>
    );
  }

  // ดึงข้อมูลสิทธิ์ปัจจุบันของผู้ใช้จากตาราง public.profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // กรณีที่ 2: หากเป็น Companion อยู่แล้ว ให้ส่งกลับหน้าแรก ไม่ต้องสมัครซ้ำ
  if (profile?.role === "companion") {
    redirect("/");
  }

  const errorMessage = getErrorMessage(error);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      {/* หัวข้อหน้า */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          สมัครเป็นผู้ช่วยร่วมเดินทาง (Care Companion)
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          ร่วมเป็นส่วนหนึ่งในการช่วยเหลือเพื่อนเดินทางไปทำธุระต่าง ๆ
          กรุณากรอกข้อมูลของคุณเพื่อใช้ในการแนะนำตัวและจับคู่กับผู้ใช้บริการ
        </p>
      </div>

      {/* ข้อความย้ำเตือนขอบเขตธุรกิจ: ไม่ใช่บริการทางการแพทย์ */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="text-sm leading-6">
          <strong className="font-semibold">ข้อตกลงและขอบเขตหน้าที่สำคัญ:</strong>{" "}
          ผู้ช่วยร่วมเดินทางมีหน้าที่ช่วยเหลือการเดินทางและทำธุระเท่านั้น ไม่ใช่บริการทางการแพทย์
        </div>
      </div>

      {/* กล่องแสดงข้อความแจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* แบบฟอร์มกรอกข้อมูลผู้ช่วยร่วมเดินทาง */}
      <form action={registerAsCompanion} className="mt-8 space-y-6">
        {/* ช่องที่ 1: ประวัติย่อ / แนะนำตัว (bio) */}
        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-stone-800">
            ประวัติย่อและการแนะนำตัว <span className="text-red-500">*</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            required
            rows={4}
            placeholder="เช่น สวัสดีครับ/ค่ะ มีประสบการณ์พาผู้สูงอายุไปทำธุระ เป็นคนใจเย็น ตรงต่อเวลา และยินดีช่วยเหลืออำนวยความสะดวกตลอดการเดินทาง"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-stone-500">
            อธิบายบุคลิกภาพหรือประสบการณ์สั้น ๆ เพื่อสร้างความมั่นใจแก่ผู้ใช้บริการ
          </p>
        </div>

        {/* ช่องที่ 2: ทักษะความเชี่ยวชาญ (skills) */}
        <div>
          <label htmlFor="skills" className="mb-1.5 block text-sm font-medium text-stone-800">
            ทักษะและความสามารถพิเศษ <span className="text-red-500">*</span>
          </label>
          <textarea
            id="skills"
            name="skills"
            required
            rows={3}
            placeholder="เช่น ช่วยพยุงเดิน, สามารถช่วยพับหรือเข็นวีลแชร์ได้, สื่อสารภาษาอังกฤษได้เบื้องต้น, คุ้นเคยกับขั้นตอนในโรงพยาบาล"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-stone-500">
            ระบุทักษะการช่วยเหลือการเดินทาง (เน้นย้ำ: ไม่เกี่ยวข้องกับหัตถการทางการแพทย์)
          </p>
        </div>

        {/* ช่องที่ 3: พื้นที่ให้บริการ (service_areas) */}
        <div>
          <label htmlFor="service_areas" className="mb-1.5 block text-sm font-medium text-stone-800">
            พื้นที่ที่สะดวกให้บริการ <span className="text-red-500">*</span>
          </label>
          <input
            id="service_areas"
            type="text"
            name="service_areas"
            required
            placeholder="เช่น เขตพญาไท, บางซื่อ, จตุจักร หรือเส้นทางแนวรถไฟฟ้า BTS/MRT"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-stone-500">
            ระบุเขต อำเภอ จังหวัด หรือแนวขนส่งสาธารณะที่คุณสะดวกเดินทางไปร่วมทริป
          </p>
        </div>

        {/* ช่องที่ 4: วันเวลาที่สะดวก (available_days) */}
        <div>
          <label htmlFor="available_days" className="mb-1.5 block text-sm font-medium text-stone-800">
            ช่วงวันและเวลาที่สะดวกให้บริการ <span className="text-red-500">*</span>
          </label>
          <input
            id="available_days"
            type="text"
            name="available_days"
            required
            placeholder="เช่น วันจันทร์ - ศุกร์ (09:00 - 16:00 น.) หรือ เสาร์ - อาทิตย์ เต็มวัน"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm outline-none ring-teal-600 transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-stone-500">
            ระบุวันและช่วงเวลาโดยประมาณที่คุณพร้อมรับงานร่วมเดินทาง
          </p>
        </div>

        {/* ปุ่มกดยืนยันการลงทะเบียน */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full rounded-full bg-teal-600 px-5 py-3 text-base font-semibold text-white shadow-md transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            ยืนยันการลงทะเบียนเป็นผู้ช่วยร่วมเดินทาง
          </button>
        </div>
      </form>
    </main>
  );
}
