import Link from "next/link";
import { CheckCircle2, MapPin, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type HomePageProps = {
  searchParams: Promise<{ companion?: string }>;
};

/**
 * หน้าแรกของระบบ Care Companion
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      {/* แจ้งเตือนเมื่อสมัครเป็น Companion สำเร็จ */}
      {companion === "success" && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-teal-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">
            สมัครเป็นผู้ช่วยร่วมเดินทางเรียบร้อยแล้ว คุณสามารถรับคำขอช่วยเหลือการเดินทางได้ตามข้อมูลที่กรอกไว้
          </p>
        </div>
      )}

      <section className="max-w-2xl">
        <p className="text-sm font-medium text-teal-700">แพลตฟอร์มผู้ช่วยร่วมเดินทาง</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-stone-800 sm:text-4xl">
          มีเพื่อนเดินทางไปทำธุระ นอกบ้านได้สบายใจขึ้น
        </h1>
        <p className="mt-4 text-lg leading-8 text-stone-600">
          Care Companion เชื่อมผู้ที่ต้องการผู้ช่วยไปโรงพยาบาล ธนาคาร
          หรือหน่วยงานราชการ กับผู้ช่วยร่วมเดินทางในพื้นที่ใกล้คุณ
        </p>
        <p className="mt-3 text-sm text-stone-500">
          ผู้ช่วยมีหน้าที่ช่วยเหลือการเดินทางและทำธุระเท่านั้น ไม่ใช่บริการทางการแพทย์
        </p>

        {user && role === "customer" && (
          <Link
            href="/become-companion"
            className="mt-6 inline-flex rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            สมัครเป็นผู้ช่วยร่วมเดินทาง (Become a Companion)
          </Link>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <Users className="h-6 w-6 text-teal-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-stone-800">สำหรับผู้ใช้บริการ</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            เข้าสู่ระบบด้วย Google แล้วสร้างคำขอรับบริการเมื่อต้องการผู้ช่วยร่วมเดินทาง
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <MapPin className="h-6 w-6 text-teal-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-stone-800">สำหรับผู้ช่วยร่วมเดินทาง</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            ลงทะเบียนโปรไฟล์ ระบุพื้นที่และเวลาที่สะดวก จากนั้นรับงานช่วยเหลือการเดินทาง
          </p>
        </article>
      </section>
    </main>
  );
}
