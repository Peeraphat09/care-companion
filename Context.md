# Care Companion - System Architecture & Business Context

เอกสารนี้เป็นแหล่งอ้างอิงหลักของ **ความต้องการ (Requirement), กฎธุรกิจ, สิทธิ์ผู้ใช้ และสคีมาฐานข้อมูล** ของระบบ ห้ามเพิ่มคอลัมน์หรือกฎที่ขัดแย้งกับเอกสารนี้ หากต้องเปลี่ยนให้แก้เอกสารนี้ก่อน

## 1. Project Overview & Business Boundary

- **ชื่อระบบ:** Care Companion (เว็บแอปพลิเคชันแพลตฟอร์มกลาง)
- **ที่มา:** ผู้สูงอายุ ผู้ที่เดินทางคนเดียวไม่สะดวก หรือผู้ที่ต้องการความช่วยเหลือ มักลำบากเมื่อครอบครัวไม่สามารถไปด้วยได้ เช่น ไปพบแพทย์ตามนัด/โรงพยาบาล, ธนาคาร, หน่วยงานราชการ, ซื้อสินค้า หรือธุระอื่นนอกบ้าน
- **วัตถุประสงค์:** เป็นแพลตฟอร์มกลางเชื่อมผู้ที่ต้องการผู้ช่วยร่วมเดินทาง (**Customer**) กับผู้ให้บริการร่วมเดินทาง (**Companion**)
- **ข้อจำกัดทางธุรกิจที่เข้มงวด (Strict Boundary):** Companion มีหน้าที่ช่วยเหลือและอำนวยความสะดวกในการเดินทางและการทำธุระเท่านั้น **ไม่ใช่ผู้ให้บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วย** ห้ามมีฟีเจอร์/ข้อความ/ฟอร์มที่สื่อถึงการรักษาหรือคัดกรองทางการแพทย์ และทุกหน้าที่มีการสมัคร/สร้างคำขอ/บริหาร ต้องมีข้อความย้ำเตือนขอบเขตนี้

## 2. Requirement จากโจทย์ (Assignment + Midterm)

งานนี้นักศึกษาต้องทำหน้าที่เป็น **System Analyst, UX/UI Designer และ Full Stack Developer** วิเคราะห์และออกแบบ Feature, User Flow, Database, Business Rules, Security, Dashboard และส่วนประกอบอื่นด้วยตนเอง เพื่อให้ระบบสมบูรณ์และใช้งานได้สมจริง **ระบบที่ส่งต้อง Deploy บน Vercel และใช้งานจริงได้**

### 2.1 Tech Stack ที่โจทย์กำหนด

| ส่วน | เทคโนโลยี |
| :-- | :-- |
| Frontend / Full Stack | Next.js + Tailwind CSS |
| Authentication | Google Account ทำงานร่วมกับ Supabase Authentication |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage |
| Deployment | Vercel |

### 2.2 ข้อกำหนดเชิงหน้าที่ (Functional Requirements) และสถานะ

| # | Requirement จากโจทย์ | การรองรับในระบบ | สถานะ |
| :-- | :-- | :-- | :-- |
| R1 | Customer/Companion เข้าชมข้อมูลเบื้องต้นของแพลตฟอร์มและข้อมูลที่เหมาะสมต่อการเผยแพร่ได้ | หน้าแรก `/` และรายชื่อผู้ช่วย `/companions` เข้าดูได้โดยไม่ต้องล็อกอิน (แสดงเฉพาะข้อมูลที่เหมาะสมต่อการเผยแพร่) | ✅ |
| R2 | Customer ระบุความต้องการ: ประเภทธุระ, วัน-เวลา, ต้นทาง, จุดหมาย, ระยะเวลา, รายละเอียด | ฟอร์ม `/requests/new` | ✅ |
| R3 | Customer ค้นหาหรือเลือก Companion ที่เหมาะสม | ค้นหาที่ `/companions` แล้วสร้างคำขอแบบ "เจาะจงผู้ช่วย" หรือปล่อยเป็นคำขอแบบเปิด | ✅ |
| R4 | Companion นำเสนอข้อมูลตนเอง: ประสบการณ์, ความสามารถ, พื้นที่ให้บริการ, ช่วงเวลาที่สะดวก และข้อมูลอื่นที่จำเป็น | `/become-companion` → `companion_profiles` (bio, skills, service_areas, available_days) | ✅ (แก้ไขโปรไฟล์และสวิตช์ `is_available` ได้ที่ `/profile`) |
| R5 | Companion ตอบรับการเป็นผู้ช่วยร่วมเดินทาง | ปุ่มตอบรับใน `/my-requests` | ✅ |
| R6 | ต้องเข้าสู่ระบบด้วย Google Account ทั้ง Customer และ Companion | Supabase Auth (Google OAuth) + `/auth/callback` | ✅ |
| R7 | รองรับกระบวนการ ค้นหา/ร้องขอ → ตอบรับ → ให้บริการ → สิ้นสุดบริการ | Service Lifecycle (หัวข้อ 4) | ✅ |
| R8 | จัดการข้อมูลและสิทธิ์ผู้ใช้แต่ละประเภทอย่างเหมาะสม | Role ใน `profiles.role` + ตรวจใน Server Action + RLS | ⚠️ ดูรายงานใน `review.md` |
| R9 | Admin บริหารข้อมูลภาพรวมแพลตฟอร์ม และจัดการข้อมูลทั้ง Customer และ Companion | `/admin`: สถิติ, เปลี่ยน Role, ดูคำขอทั้งหมด | ✅ (ยังไม่มีระงับ/ลบผู้ใช้ และแก้ข้อมูล Companion) |
| R10 | ใช้ Supabase Storage | อัปโหลดรูปโปรไฟล์ไปยัง Bucket `companion-files` (โฟลเดอร์ `<user_id>/`) ที่ `/profile` — ต้องตั้ง Storage policy ตามหัวข้อ 8 | ✅ (หลังตั้ง policy) |
| R11 | Deploy บน Vercel ใช้งานจริงได้ | ต้องตั้ง Env และ Redirect URL ของ Google OAuth/Supabase ให้ตรงโดเมนจริง | ⏳ ตรวจก่อนส่ง |

> ตารางนี้เป็นภาพรวมเทียบโจทย์ ณ ปัจจุบัน — เมื่อทำรายการใดเสร็จให้อัปเดตสถานะที่นี่

## 3. User Roles & Capabilities

ระบบแบ่งสิทธิ์ผู้ใช้งานเป็น 3 กลุ่ม (เก็บที่ `profiles.role`) ผู้ใช้ทุกคนที่ล็อกอินครั้งแรกจะเป็น `customer`

### 3.1 Customer (ผู้ใช้บริการ)
- เข้าสู่ระบบด้วย Google Account ผ่าน Supabase Auth
- ค้นหา/ดูโปรไฟล์ Companion (ทักษะ, พื้นที่ให้บริการ, เวลาที่สะดวก) และเลือกผู้ช่วยที่เหมาะสม
- สร้างคำขอรับบริการ: ประเภทธุระ, วัน-เวลา, ต้นทาง, จุดหมาย, ระยะเวลาชั่วโมง, รายละเอียดเพิ่มเติม
- ติดตามสถานะคำขอของตนเอง และยกเลิกคำขอได้ (ตามเงื่อนไขหัวข้อ 5)
- สมัครเป็น Companion ได้ผ่าน `/become-companion`

### 3.2 Companion (ผู้ให้บริการร่วมเดินทาง)
- เข้าสู่ระบบด้วย Google Account
- จัดการโปรไฟล์ผู้ช่วย: Bio, ทักษะ, พื้นที่ให้บริการ, วัน/เวลาที่สะดวก และสวิตช์พร้อมรับงาน (`is_available`)
- ดูคำขอที่เปิดรอผู้ช่วย และคำขอที่ระบุถึงตนเอง แล้ว **ตอบรับ (Accept)** (หรือปฏิเสธคำขอที่เจาะจงถึงตน)
- อัปเดตสถานะงานที่รับไว้: `accepted → in_progress → completed`
- **Companion เป็นฝั่งผู้ให้บริการ ไม่สร้างคำขอรับบริการ** (ดูกฎข้อ 5.1)

### 3.3 Admin (ผู้ดูแลระบบ)
- ดูภาพรวมสถิติของแพลตฟอร์ม (จำนวนผู้ใช้แต่ละ Role, จำนวนคำขอแต่ละสถานะ)
- จัดการผู้ใช้ทั้ง Customer และ Companion (เปลี่ยน Role)
- ตรวจสอบรายการคำขอรับบริการทั้งหมด
- ไม่ควรลดสิทธิ์ตนเองจนระบบไม่มีแอดมิน

## 4. Service Lifecycle (`public.service_requests.status`)

```
pending ─(Companion ตอบรับ)→ accepted ─(เริ่มเดินทาง)→ in_progress ─(เสร็จ)→ completed
   └────────────(ยกเลิก)────────┴──→ cancelled
```

1. **pending**: Customer สร้างคำขอ รอ Companion ตอบรับ (แบบเปิด = ไม่มี `companion_id` / แบบเจาะจง = มี `companion_id`)
2. **accepted**: Companion ตอบรับแล้ว
3. **in_progress**: กำลังเดินทาง/ให้บริการ
4. **completed**: สิ้นสุดบริการเรียบร้อย
5. **cancelled**: ยกเลิก (โดย Customer หรือ Companion ที่รับงาน)

## 5. Business Rules

### 5.1 การแยกบทบาท
- Customer สร้างคำขอได้ / Companion **สร้างคำขอไม่ได้** และต้องไม่เห็นเมนู/ปุ่มสร้างคำขอ
- Companion ตอบรับงานได้ ส่วน Customer ตอบรับงานไม่ได้
- Admin เป็นผู้บริหารระบบ ไม่ใช่ผู้ร่วมกระบวนการให้บริการ
- ผู้ใช้ 1 บัญชีมี 1 Role ณ ขณะใดขณะหนึ่ง

### 5.2 การสร้างคำขอ
- ต้องกรอกครบ: ประเภทธุระ, ต้นทาง, จุดหมาย, วัน-เวลา, ระยะเวลา
- วัน-เวลานัดหมายต้องเป็นอนาคต และระยะเวลาเป็นจำนวนเต็มบวกในช่วงที่สมเหตุสมผล (ไม่เกิน 24 ชั่วโมง)
- คำขอเจาะจง (`companion_id`) ต้องอ้างถึง Companion ที่มีอยู่จริงและเปิดรับงาน

### 5.3 การตอบรับและเปลี่ยนสถานะ
- ตอบรับได้เมื่อสถานะ `pending` เท่านั้น, ไม่ใช่คำขอของตนเอง, และถ้าเป็นคำขอเจาะจงต้องเป็นผู้ช่วยที่ถูกระบุ
- Companion รับงานเวลาซ้อนทับกันไม่ได้ (เช็คกับงาน `accepted`/`in_progress`)
- การอัปเดตสถานะต้องมีเงื่อนไขสถานะเดิม (กันสองคนกดพร้อมกัน) และถ้าไม่มีแถวถูกอัปเดตต้องแจ้งว่าไม่สำเร็จ
- ลำดับที่อนุญาต: `accepted → in_progress → completed` เท่านั้น (ห้ามข้ามขั้น/ย้อนกลับ), ยกเลิกได้เฉพาะ `pending`/`accepted`
- เฉพาะ Companion ที่ได้รับมอบหมายเปลี่ยนเป็น `in_progress`/`completed` ได้

### 5.4 ความเป็นส่วนตัว
- เบอร์โทร/ข้อมูลติดต่อของอีกฝ่ายแสดงเฉพาะเมื่อมีความสัมพันธ์ในงานนั้นแล้ว (หลัง `accepted`)
- หน้า public (`/`, `/companions`) แสดงเฉพาะข้อมูลที่เหมาะสมต่อการเผยแพร่ (ชื่อ, รูป, bio, ทักษะ, พื้นที่, วัน/เวลาที่สะดวก) ไม่แสดงเบอร์โทร

## 6. Security Model

- **Authentication:** Google OAuth ผ่าน Supabase; `middleware.ts` รีเฟรช session ทุกคำขอ
- **Authorization ชั้นแอป:** ทุก Server Action/หน้าที่จำกัดสิทธิ์ อ่าน role จากตาราง `profiles` (ไม่เชื่อค่าจากฟอร์ม/URL)
- **Authorization ชั้นฐานข้อมูล:** เปิด RLS ทุกตาราง ใช้ `createClient()` (anon key + cookie ผู้ใช้) เป็นค่าเริ่มต้น
- **Service Role Key** (`createAdminClient`) ใช้เฉพาะงานที่ต้องข้าม RLS โดยตรวจว่าผู้เรียกเป็น admin แล้วเท่านั้น และห้ามหลุดไปฝั่ง client
- **การเปลี่ยน Role:** ผู้ใช้ทั่วไปต้องไม่สามารถแก้ `profiles.role` ของตนเองได้โดยตรง — โค้ดเปลี่ยน role ผ่าน `createAdminClient()` เท่านั้น (`/admin` และ `/become-companion` ซึ่งตั้งได้เฉพาะ `customer → companion`) และต้องรัน SQL ใน Supabase เพื่อปิดช่องฝั่ง DB: `REVOKE UPDATE (role) ON public.profiles FROM authenticated;` (หรือใช้ trigger)
- **การปฏิเสธคำขอเจาะจง:** Companion ที่ถูกระบุกด "ปฏิเสธ" → `companion_id` กลับเป็น `null` (คำขอกลายเป็นแบบเปิด) ไม่ยกเลิกคำขอของลูกค้า
- ป้องกัน Open Redirect ใน `/auth/callback` (`next` ต้องเป็น path ภายใน)

## 7. Database Schema (Supabase PostgreSQL)

*ฐานข้อมูลเปิดใช้งาน Row Level Security (RLS) ทุกตาราง — สคีมาและ Policy อยู่ใน Supabase ไม่มี migration ในรีโพ*

### 7.1 `public.profiles`
- `id` (UUID, PK → `auth.users.id` ON DELETE CASCADE)
- `full_name` (text, Not Null)
- `avatar_url` (text)
- `phone` (text)
- `role` (text, Default `'customer'`) — `'customer' | 'companion' | 'admin'`
- `created_at` (timestamptz, Default `now()`)

### 7.2 `public.companion_profiles`
- `id` (UUID, PK → `public.profiles.id` ON DELETE CASCADE)
- `bio` (text) — ประวัติย่อ/ประสบการณ์
- `skills` (text) — ความสามารถ เช่น การใช้วีลแชร์, ภาษา
- `service_areas` (text) — พื้นที่ให้บริการ
- `available_days` (text) — วัน/เวลาที่สะดวก
- `is_available` (bool, Default `true`) — สถานะเปิดรับงาน
- `updated_at` (timestamptz, Default `now()`)

### 7.3 `public.service_requests`
- `id` (UUID, PK, Default `gen_random_uuid()`)
- `customer_id` (UUID, Not Null → `public.profiles.id`)
- `companion_id` (UUID, Nullable → `public.profiles.id`)
- `task_type` (text, Not Null) — เช่น ไปโรงพยาบาล, ติดต่อราชการ, ธนาคาร, ซื้อของ
- `origin` (text, Not Null) — สถานที่ต้นทาง/จุดนัดพบ
- `destination` (text, Not Null) — จุดหมายปลายทาง
- `appointment_date` (timestamptz, Not Null)
- `duration_hours` (int4, Not Null)
- `notes` (text)
- `status` (text, Default `'pending'`) — `'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'`
- `created_at` (timestamptz, Default `now()`)

## 8. Storage Buckets

- Bucket: `companion-files` (Public)
- ใช้เก็บรูปโปรไฟล์ของผู้ใช้ทุก role ที่ path `<user_id>/avatar-<timestamp>.<jpg|png|webp>` (ไม่เกิน 2MB) อัปโหลดจาก `/profile`
- Storage policy ที่ต้องมีบน `storage.objects`: อนุญาต INSERT/DELETE เฉพาะ `bucket_id = 'companion-files'` และโฟลเดอร์แรกของ path เท่ากับ `auth.uid()::text` (Bucket เป็น Public จึงอ่านได้ทุกคน)
- สิทธิ์คอลัมน์ `profiles`: `GRANT UPDATE (full_name, avatar_url, phone) ON public.profiles TO authenticated;`
- ข้อควรระวัง: bucket แบบ Public ห้ามเก็บเอกสารยืนยันตัวตนที่เป็นความลับ ถ้าจะเก็บควรใช้ Private bucket + signed URL

## 9. Deployment (Vercel)

- ตั้ง Environment Variables บน Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (อย่างหลังเป็นความลับ ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_`)
- เพิ่มโดเมน Vercel ใน Supabase → Authentication → URL Configuration (Site URL / Redirect URLs รวม `/auth/callback`) และใน Google Cloud OAuth Authorized redirect URIs
- ทดสอบ flow เต็ม (ล็อกอิน → สร้างคำขอ → รับงาน → จบงาน → Admin) บนโดเมน production ก่อนส่ง
