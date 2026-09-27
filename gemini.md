# Care Companion - Agent Guidelines (แนวทางพัฒนาระบบ)

เอกสารฉบับนี้กำหนดมาตรฐานและแนวทางการพัฒนาโค้ดสำหรับโปรเจกต์ **Care Companion** เว็บแอปพลิเคชันเชื่อมโยงผู้ช่วยร่วมเดินทางกับผู้ต้องการความช่วยเหลือ (สร้างด้วย Next.js App Router, Supabase และ Tailwind CSS) เพื่อให้โค้ดมีความเป็นระเบียบ เข้าใจง่าย เหมาะสำหรับงานส่งอาจารย์และการทำงานร่วมกัน

---

## 1. ขอบเขตธุรกิจและหลักการสำคัญ (Core Business Boundaries)
- **บริการหลัก:** แพลตฟอร์มกลางสำหรับหาผู้ช่วยร่วมเดินทางไปทำธุระ เช่น ไปโรงพยาบาลตามนัด, ติดต่อธนาคาร, ติดต่อหน่วยงานราชการ หรือซื้อของ
- **ข้อจำกัดสำคัญที่สุด (Strict Boundary):** Companion เป็นเพียงผู้ช่วยอำนวยความสะดวกในการเดินทางและทำธุระเท่านั้น **ไม่ใช่บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วยโดยเด็ดขาด**
- ทุกหน้าและจุดที่มีการรับสมัครหรือสร้างคำขอ ต้องมีข้อความย้ำเตือนถึงขอบเขตนี้อย่างชัดเจน

---

## 2. โครงสร้างสิทธิ์และฐานข้อมูล (Roles & Database Schema)

### 2.1 สิทธิ์ผู้ใช้งาน (Roles)
1. **`customer` (ผู้ใช้บริการ):** สิทธิ์เริ่มต้นของผู้ใช้ทุกคนที่เข้าสู่ระบบด้วย Google สามารถค้นหาผู้ช่วยและสร้างคำขอรับบริการได้
2. **`companion` (ผู้ช่วยร่วมเดินทาง):** ผู้ใช้ที่ลงทะเบียนข้อมูลเพิ่มเติมใน `companion_profiles` สำเร็จ สามารถรับงานและอัปเดตสถานะงานได้
3. **`admin` (ผู้ดูแลระบบ):** ผู้ดูแลภาพรวมและจัดการสิทธิ์ของผู้ใช้ในระบบ

### 2.2 โครงสร้างตารางใน Supabase (PostgreSQL with RLS)
- **`public.profiles`:** ข้อมูลผู้ใช้ทุกคน เชื่อมกับ `auth.users`
  - ฟิลด์: `id`, `full_name`, `avatar_url`, `phone`, `role`, `created_at`
- **`public.companion_profiles`:** ข้อมูลเฉพาะของผู้ช่วยร่วมเดินทาง
  - ฟิลด์: `id`, `bio`, `skills`, `service_areas`, `available_days`, `is_available`, `updated_at`
- **`public.service_requests`:** ข้อมูลคำขอรับบริการ
  - ฟิลด์: `id`, `customer_id`, `companion_id`, `task_type`, `origin`, `destination`, `appointment_date`, `duration_hours`, `notes`, `status`, `created_at`

---

## 3. สถาปัตยกรรมและเทคโนโลยีที่บังคับใช้ (Tech Stack & Architecture)

### 3.1 Next.js App Router
- ใช้โครงสร้างโฟลเดอร์ตาม Next.js App Router (`app/`)
- แยกหน้าที่ระหว่าง Server Components (ค่าเริ่มต้น) และ Client Components (`"use client"`) อย่างชัดเจน
- ใช้ Server Actions (`"use server"`) สำหรับการเปลี่ยนแปลงข้อมูล (Mutations)

### 3.2 Supabase SSR (`@supabase/ssr`)
- ฝั่ง **Client Components**: ใช้ `createBrowserClient` ผ่านฟังก์ชันตัวช่วย `@/utils/supabase/client`
- ฝั่ง **Server Components / Actions / Route Handlers**: ใช้ `createServerClient` ผ่านฟังก์ชันตัวช่วย `@/utils/supabase/server` โดยจัดการ Cookies ผ่าน `cookies()` ของ `next/headers`
- มี `middleware.ts` คอยรีเฟรช Auth Token ผ่าน cookies อัตโนมัติ

---

## 4. มาตรฐานการเขียนโค้ด (Coding Standards)

1. **สไตล์โค้ดระดับนักศึกษา (Student-friendly & Pragmatic):**
   - เรียบง่าย ตรงไปตรงมา อ่านแล้วเข้าใจ flow ได้ทันที
   - ไม่ Over-engineering ไม่ใช้นามธรรมหรือ architecture ที่ซับซ้อนเกินความจำเป็น
   - โครงสร้างไฟล์แยกสัดส่วนชัดเจน เข้าถึงง่าย

2. **คอมเมนต์ภาษาไทย (Mandatory Thai Comments):**
   - บังคับใส่ Comment ภาษาไทยอธิบายทุกฟังก์ชัน, Server Action, Component และบล็อกตรรกะสำคัญ
   - อธิบายว่าโค้ดส่วนนี้ทำอะไร และทำไปทำไม

3. **ภาษาบน UI (User Interface Language):**
   - ข้อความทั้งหมดบน UI ต้องเป็น **ภาษาไทย** ที่สุภาพ เป็นกันเอง และเข้าใจง่าย
   - ฟอนต์และขนาดตัวอักษรอ่านง่าย สบายตา เหมาะสำหรับผู้ใช้ทุกวัย รวมถึงผู้สูงอายุ
