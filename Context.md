# Care Companion - System Architecture & Business Context

## 1. Project Overview & Business Boundary
- **ชื่อระบบ:** Care Companion (เว็บแอปพลิเคชันแพลตฟอร์มกลาง)
- **วัตถุประสงค์:** เชื่อมโยงผู้ที่ต้องการผู้ช่วยร่วมเดินทางไปทำธุระ/โรงพยาบาล (Customer) กับผู้ให้บริการร่วมเดินทาง (Companion)
- **ข้อจำกัดทางธุรกิจที่เข้มงวด (Strict Boundary):** Companion มีหน้าที่ช่วยเหลือและอำนวยความสะดวกในการเดินทางและการทำธุระเท่านั้น (เช่น ไปพบแพทย์ตามนัด, ไปธนาคาร, ติดต่อหน่วยงานราชการ, ซื้อของ) **ไม่ใช่ผู้ให้บริการทางการแพทย์และไม่ใช่ผู้ดูแลรักษาผู้ป่วย**

---

## 2. User Roles & Capabilities
ระบบแบ่งสิทธิ์ผู้ใช้งานออกเป็น 3 กลุ่มหลัก

### 2.1 Customer (ผู้ใช้บริการ)
- เข้าสู่ระบบด้วย Google Account ผ่าน Supabase Auth
- ค้นหา Companion ตามพื้นที่ให้บริการและเวลาที่สะดวก
- สร้างคำขอรับบริการ (Service Request) โดยระบุ: ประเภทธุระ, วัน-เวลา, สถานที่ต้นทาง, จุดหมายปลายทาง, ระยะเวลาชั่วโมง และรายละเอียดเพิ่มเติม
- ติดตามสถานะคำขอรับบริการของตนเอง

### 2.2 Companion (ผู้ให้บริการร่วมเดินทาง)
- เข้าสู่ระบบด้วย Google Account ผ่าน Supabase Auth
- จัดการข้อมูลโปรไฟล์ผู้ช่วย: ประวัติย่อ (Bio), ทักษะ/ความสามารถ, พื้นที่ให้บริการ, วัน/เวลาที่สะดวก และสวิตช์เปิด-ปิดสถานะพร้อมรับงาน (is_available)
- ดูรายการคำขอรับบริการที่เข้ามา และกด "ตอบรับงาน" (Accept)
- อัปเดตสถานะการดำเนินงาน (In Progress -> Completed)

### 2.3 Admin (ผู้ดูแลระบบ)
- ดูภาพรวมสถิติของแพลตฟอร์ม (จำนวนผู้ใช้, จำนวนคำขอ, สถานะงาน)
- จัดการข้อมูลผู้ใช้งานทั้ง Customer และ Companion (เปลี่ยน Role / ระงับการใช้งาน)
- ตรวจสอบรายการคำขอรับบริการทั้งหมดในระบบ

---

## 3. Service Lifecycle (สถานะคำขอรับบริการ)
วงจรชีวิตของ Service Request (`public.service_requests.status`)
1. **pending**: Customer สร้างคำขอใหม่ รอ Companion ตอบรับ
2. **accepted**: Companion ตอบรับคำขอแล้ว
3. **in_progress**: กำลังอยู่ในระหว่างการเดินทาง/ให้บริการ
4. **completed**: สิ้นสุดการให้บริการเรียบร้อยแล้ว
5. **cancelled**: ยกเลิกคำขอ (โดย Customer หรือ Companion)

---

## 4. Database Schema (Supabase PostgreSQL)
*ฐานข้อมูลเปิดใช้งาน Row Level Security (RLS) ทั้งหมด*

### 4.1 Table: `public.profiles`
ตารางเก็บข้อมูลโปรไฟล์พื้นฐานของผู้ใช้ทุกคน (เชื่อมกับ Supabase Auth):
- `id` (UUID, Primary Key -> `auth.users.id` ON DELETE CASCADE)
- `full_name` (text, Not Null)
- `avatar_url` (text)
- `phone` (text)
- `role` (text, Default: 'customer') -- ค่าที่รองรับ: 'customer' | 'companion' | 'admin'
- `created_at` (timestamptz, Default: now())

### 4.2 Table: `public.companion_profiles`
ตารางเก็บข้อมูลเพิ่มเติมเฉพาะผู้ใช้ที่เป็น Companion:
- `id` (UUID, Primary Key -> `public.profiles.id` ON DELETE CASCADE)
- `bio` (text) -- ประวัติย่อ/แนะนำตัว
- `skills` (text) -- ทักษะพิเศษ เช่น การใช้วีลแชร์, ภาษา
- `service_areas` (text) -- พื้นที่ให้บริการ เช่น เขตพญาไท, กรุงเทพฯ โซนเหนือ
- `available_days` (text) -- วัน/เวลาที่สะดวก
- `is_available` (bool, Default: true) -- สถานะเปิดรับงาน
- `updated_at` (timestamptz, Default: now())

### 4.3 Table: `public.service_requests`
ตารางเก็บรายการคำขอรับบริการและการจ้างงาน:
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `customer_id` (UUID, Not Null -> `public.profiles.id`)
- `companion_id` (UUID, Nullable -> `public.profiles.id`)
- `task_type` (text, Not Null) -- เช่น ไปโรงพยาบาล, ติดต่อราชการ, ซื้อของ
- `origin` (text, Not Null) -- จุดเริ่มต้น
- `destination` (text, Not Null) -- จุดหมายปลายทาง
- `appointment_date` (timestamptz, Not Null) -- วันและเวลานัดหมาย
- `duration_hours` (int4, Not Null) -- จำนวนชั่วโมงโดยประมาณ
- `notes` (text) -- ข้อควรระวังหรือรายละเอียดเพิ่มเติม
- `status` (text, Default: 'pending') -- 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
- `created_at` (timestamptz, Default: now())

---

## 5. Storage Buckets
- Bucket Name: `companion-files` (Public Bucket)
- ใช้สำหรับจัดเก็บรูปภาพประจำตัว หรือเอกสารยืนยันตัวตนของผู้ช่วยร่วมเดินทาง