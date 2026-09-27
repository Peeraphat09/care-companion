import Link from "next/link";
import { CheckCircle2, MapPin, Users, Search, PlusCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type HomePageProps = {
  searchParams: Promise<{ companion?: string }>;
};

/**
 * หน้าแรกของระบบ Care Companion (Server Component)
 */
export default async function Home({ searchParams }: Readonly<HomePageProps>) {
  const { companion } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "customer";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? "customer";
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-14">
      {/* แจ้งเตือนเมื่อสมัครเป็น Companion สำเร็จ */}
      {companion === "success" && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-teal-900 shadow-xs">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
          <p className="text-sm leading-6">
            สมัครเป็นผู้ช่วยร่วมเดินทางเรียบร้อยแล้ว คุณสามารถรับคำขอช่วยเหลือการเดินทางได้ตามข้อมูลที่กรอกไว้
          </p>
        </div>
      )}

      {/* ส่วน Hero นำเสนอแพลตฟอร์ม */}
      <section className="max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3.5 py-1 text-xs font-semibold text-teal-800">
          <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden="true" />
          แพลตฟอร์มผู้ช่วยร่วมเดินทาง Care Companion
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
          มีเพื่อนเดินทางไปทำธุระ <br className="hidden sm:inline" />
          นอกบ้านได้สบายใจขึ้น
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">
          Care Companion เชื่อมผู้ที่ต้องการผู้ช่วยไปโรงพยาบาล ธนาคาร
          หรือติดต่อหน่วยงานราชการ กับผู้ช่วยร่วมเดินทางในพื้นที่ใกล้คุณ
        </p>
        <p className="mt-2 text-xs text-stone-500 sm:text-sm">
          ⚠️ ผู้ช่วยมีหน้าที่ช่วยเหลือการเดินทางและทำธุระเท่านั้น ไม่ใช่บริการทางการแพทย์และไม่ใช่ผู้ดูแลรักษาผู้ป่วย
        </p>

        {/* ปุ่ม Call-to-Action หลัก */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/companions"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>ค้นหาผู้ช่วยร่วมเดินทาง</span>
          </Link>

          <Link
            href="/requests/new"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 hover:text-stone-900"
          >
            <PlusCircle className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span>สร้างคำขอรับบริการ</span>
          </Link>

          {user && role === "customer" && (
            <Link
              href="/become-companion"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline px-2 py-1"
            >
              <span>สมัครเป็นผู้ช่วยร่วมเดินทาง</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}

          {user && role === "companion" && (
            <Link
              href="/my-requests"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline px-2 py-1"
            >
              <span>ไปที่ศูนย์รวมงานบริการ</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      {/* ส่วนแนะนำสำหรับ 2 บทบาทผู้ใช้ */}
      <section className="mt-14 grid gap-6 sm:grid-cols-2">
        {/* การ์ดสำหรับผู้ใช้บริการ (Customer) */}
        <article className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-teal-200">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-stone-800">สำหรับผู้ใช้บริการ (Customer)</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              ค้นหาผู้ช่วยร่วมเดินทางที่สะดวกในพื้นที่ของคุณ หรือสร้างคำขอรับบริการระบุวัน เวลา สถานที่ และธุระที่ต้องการไปทำ
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-stone-100">
            <Link
              href="/companions"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
            >
              <span>ดูรายชื่อผู้ช่วย</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <span className="text-stone-300">|</span>
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
            >
              <span>สร้างคำขอใหม่</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* การ์ดสำหรับผู้ช่วยร่วมเดินทาง (Companion) */}
        <article className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-teal-200">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <MapPin className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-stone-800">สำหรับผู้ช่วยร่วมเดินทาง (Companion)</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              ลงทะเบียนโปรไฟล์ ระบุพื้นที่และเวลาที่สะดวก จากนั้นตรวจสอบคำขอและกดตอบรับงานเพื่อร่วมเดินทางไปทำธุระ
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-stone-100">
            {role === "companion" ? (
              <Link
                href="/my-requests"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
              >
                <span>ตรวจสอบงานที่รอรับ</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                href="/become-companion"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
              >
                <span>สมัครเป็นผู้ช่วยร่วมเดินทาง</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
