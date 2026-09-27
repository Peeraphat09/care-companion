# รายงานการตรวจสอบและวิเคราะห์ข้อผิดพลาด (Code & Security Review)
**โปรเจกต์:** Care Companion Web Application  
**สถานะ:** รายงานผลการวิเคราะห์ทางเทคนิค (ห้ามแก้ไขโค้ดในระบบโดยตรงตามข้อกำหนด)

---

## 1. สรุปสาเหตุหลักที่ระบบไม่สามารถบันทึกข้อมูลได้ (Root Cause)

จากการตรวจสอบโฟลว์การทำงานของหน้า `/requests/new` (`app/requests/new/page.tsx` และ `app/requests/new/actions.ts`):

### 🚨 ปัญหาหลัก: ขาดนโยบายความปลอดภัย Row Level Security (RLS) สำหรับคำสั่ง `INSERT` บนตาราง `service_requests`
- ใน `Context.md` ระบุชัดเจนว่า **"ฐานข้อมูลเปิดใช้งาน Row Level Security (RLS) ทั้งหมด"**
- การเรียก Supabase ผ่าน Server Action ใน `utils/supabase/server.ts` เป็นการใช้ Public API Key (`anon key` จาก `.env.local`) ซึ่งอยู่ภายใต้ข้อกำหนดของ RLS ทั้งหมด
- เมื่อไม่มีการสร้าง Policy ที่อนุญาตให้ User ที่ Authenticate แล้วทำการ `INSERT` ลงตาราง `service_requests` Supabase จะทำการบล็อกคำขอทันทีและส่ง Error กลับมา
- ใน [actions.ts](file:///e:/Projects/dev/Next.js/care-companion-app/app/requests/new/actions.ts#L74-L94) เมื่อเกิด Error จากคำสั่ง `supabase.from("service_requests").insert(...)`:
  ```typescript
  if (error) {
    console.error("Error creating service request:", error);
    redirect("/requests/new?error=save");
  }
  ```
  ระบบจึง Redirect ผู้ใช้กลับไปที่ `/requests/new?error=save` และแสดงข้อความเตือนสีแดง: *"เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง"*

---

## 2. การวิเคราะห์จุดผิดพลาดแยกตามหมวดหมู่ (Breakdown Analysis)

### 2.1 ฝั่ง Supabase Database & Security (จุดตายหลัก)
1. **ขาด RLS Policy สำหรับ `INSERT` บน `service_requests`:**
   - ผู้ใช้ล็อกอินแล้ว (`auth.uid()`) ไม่ได้รับสิทธิ์ให้เพิ่มแถวใหม่ที่มี `customer_id = auth.uid()`
2. **ความเสี่ยงในตารางอื่นๆ หากเปิด RLS แต่ไม่ได้สร้าง Policy ครอบคลุม:**
   - ตาราง `companion_profiles`: การลงทะเบียนเป็นผู้ดูแลผ่าน `app/become-companion/actions.ts` ใช้ `.upsert()` หากไม่มี Policy รองรับ `INSERT/UPDATE` ก็จะพังเช่นเดียวกัน
   - ตาราง `service_requests`: ขาด Policy สำหรับการ `UPDATE` สถานะหรือการรับงาน (`companion_id`) ใน `app/my-requests/actions.ts`

### 2.2 ฝั่ง Server Action (`app/requests/new/actions.ts`)
1. **การจัดการข้อความ Error ยังคลุมเครือ (Generic Error):**
   - ในกรณีที่ Supabase ส่ง error code เช่น RLS violation (`42501`) หรือ foreign key constraint ไม่มีการส่ง query param ที่บอกรายละเอียดที่แท้จริง ทำให้ผู้ใช้งานและผู้พัฒนาไม่ทราบสาเหตุที่แท้จริงผ่านหน้าจอ
2. **การแปลงข้อมูล (Data Transformation) อยู่ในเกณฑ์ปลอดภัยแต่ต้องระวัง:**
   - `companionId`: มีการแปลง string ว่าง `""` เป็น `null` อย่างถูกต้อง (`companionId || null`) ซึ่งป้องกันปัญหา foreign key error กับ UUID ได้ดี
   - `durationHours`: แปลงผ่าน `parseInt(..., 10)` ถูกต้อง
   - `appointmentDate`: แปลงผ่าน `new Date(...)` และส่งออกเป็น `.toISOString()` เข้ากับประเภท `timestamptz` ได้อย่างถูกต้อง

### 2.3 ฝั่ง Frontend Form (`app/requests/new/page.tsx`)
1. **ขาด Pending/Loading State บนปุ่ม Submit:**
   - ฟอร์มใช้ Form Action ของ Next.js โดยตรงแบบ native `<form action={createServiceRequest}>` โดยไม่มีการใช้ `useActionState` หรือ `useFormStatus` ทำให้ขณะกดปุ่มไม่มี Loading indicator หรือการ Disable ปุ่ม ผู้ใช้อาจกดเบิ้ล (Double Submit) จนส่ง Request ซ้ำซ้อน
2. **การตรวจสอบ Error Message ผ่าน Search Params:**
   - รับ `searchParams` เป็น `Promise<{ error?: string }>` ถูกต้องตามสเปกของ Next.js 15+ แต่การแจ้งเตือนมีเพียง `error=missing_fields`, `error=invalid_date`, `error=save` ซึ่งกว้างเกินไป

---

## 3. แนวทางแก้ไขที่แนะนำ (Actionable Solutions)

### 3.1 สคริปต์ SQL สำหรับสร้าง RLS Policies บน Supabase (ต้องรันใน Supabase SQL Editor)

รันคำสั่ง SQL ต่อไปนี้เพื่อเปิดใช้งานสิทธิ์ RLS ให้ถูกต้องสมบูรณ์:

```sql
-- 1. ตรวจสอบว่าเปิด RLS หรือยัง
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies สำหรับตาราง service_requests
-- อนุญาตให้ลูกค้าสร้างคำขอของตนเองได้ (แก้ปัญหา /requests/new บันทึกไม่ได้)
CREATE POLICY "Customers can create their own service requests"
ON public.service_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

-- อนุญาตให้ลูกค้าและผู้ดูแลที่เกี่ยวข้องดูคำขอได้
CREATE POLICY "Users can view their related service requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = customer_id 
  OR auth.uid() = companion_id 
  OR (companion_id IS NULL AND status = 'pending')
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- อนุญาตให้อัปเดตคำขอ (เช่น ลูกค้ายกเลิก หรือ ผู้ดูแลกดรับงาน/เปลี่ยนสถานะ)
CREATE POLICY "Users can update their service requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = customer_id 
  OR auth.uid() = companion_id 
  OR (companion_id IS NULL AND status = 'pending')
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  auth.uid() = customer_id 
  OR auth.uid() = companion_id 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. RLS Policies สำหรับตาราง companion_profiles
CREATE POLICY "Anyone can view companion profiles"
ON public.companion_profiles
FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can insert or update their companion profile"
ON public.companion_profiles
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. RLS Policies สำหรับตาราง profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

---

### 3.2 ตัวอย่างโค้ดปรับปรุง Server Action ให้รองรับการ Debug ที่ดีขึ้น

ปรับปรุง `app/requests/new/actions.ts`:

```typescript
// ในฟังก์ชัน createServiceRequest ช่วง insert:
const { error } = await supabase.from("service_requests").insert({
  customer_id: user.id,
  companion_id: companionId || null,
  service_type: serviceType,
  title,
  description: description || null,
  appointment_date: parsedDate.toISOString(),
  duration_hours: durationHours,
  location,
  status: "pending",
});

if (error) {
  console.error("Supabase Insert Error:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  // สามารถส่ง error code กลับไปแสดงผลเฉพาะเจาะจงได้
  redirect(`/requests/new?error=save&reason=${encodeURIComponent(error.message)}`);
}
```

---

## 4. บั๊กและข้อบกพร่องอื่นๆ ที่ตรวจพบในโปรเจกต์ (Additional Issues)

| ลำดับ | ตำแหน่งไฟล์ | รายละเอียดข้อบกพร่อง / ความเสี่ยง | ระดับความรุนแรง |
| :--- | :--- | :--- | :--- |
| **1** | [my-requests/actions.ts](file:///e:/Projects/dev/Next.js/care-companion-app/app/my-requests/actions.ts#L45-L75) | **Race Condition ในการรับงาน (`acceptServiceRequest`):**<br>มีการตรวจสอบ `request.status !== "pending"` ก่อน แต่ไม่มีการ Lock หรือ Conditional Update ที่ระดับ DB ทำให้ถ้ามีผู้ดูแลกดรับงานพร้อมกัน 2 คน อาจเกิดการแย่งงานทับซ้อนกันได้ ควรเพิ่ม `.eq("status", "pending")` ในคำสั่ง `.update()` | 🟠 ปานกลาง |
| **2** | [become-companion/actions.ts](file:///e:/Projects/dev/Next.js/care-companion-app/app/become-companion/actions.ts#L50-L65) | **คำสั่ง `upsert` ไม่ได้ระบุ `onConflict` ชัดเจน:**<br>แม้ Supabase จะอิง Primary Key แต่ควรระบุ `{ onConflict: "id" }` ให้ชัดเจนเพื่อป้องกันข้อผิดพลาดเวลา Schema เปลี่ยน | 🟡 เล็กน้อย |
| **3** | [components/Navbar.tsx](file:///e:/Projects/dev/Next.js/care-companion-app/components/Navbar.tsx) และ [companions/page.tsx](file:///e:/Projects/dev/Next.js/care-companion-app/app/companions/page.tsx) | **ใช้แท็ก `<img>` แทน Next.js `<Image />`:**<br>มีการใส่ `eslint-disable-next-line @next/next/no-img-element` ข้ามการแจ้งเตือน ทำให้เสียคุณสมบัติ Automatic Image Optimization, WebP conversion, และ Lazy loading | 🟡 เล็กน้อย |
| **4** | [requests/new/page.tsx](file:///e:/Projects/dev/Next.js/care-companion-app/app/requests/new/page.tsx) | **ไม่มี Loading / Pending Indicator ระหว่างส่งฟอร์ม:**<br>ผู้ใช้ไม่ทราบว่าระบบกำลังบันทึกข้อมูลอยู่ อาจกดปุ่ม "ยืนยันและส่งคำขอ" ซ้ำๆ ส่งผลให้เกิด Request หลายครั้ง | 🟡 เล็กน้อย |
| **5** | [auth/callback/route.ts](file:///e:/Projects/dev/Next.js/care-companion-app/app/auth/callback/route.ts#L106-L125) | **Sync Role ระหว่าง Metadata กับ Database Profile:**<br>ใน Callback มีการอ่าน role จาก `app_metadata` หรือ fallback เป็น `customer` หาก user เคยมี profile อยู่แล้วแต่ role ใน table ถูกแก้ไขโดย Admin การ redirect อาจไม่สอดคล้องกับ Role ปัจจุบัน | 🟠 ปานกลาง |

---
*เอกสารนี้จัดทำขึ้นตามมาตรการตรวจสอบความปลอดภัยและคุณภาพโค้ด โดยไม่มีการแก้ไขไฟล์ต้นฉบับใดๆ ทั้งสิ้น*
