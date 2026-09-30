# Code Review: Care Companion

**ขอบเขต:** โค้ดทั้งหมดใน working tree ปัจจุบัน (รวมการเปลี่ยนแปลงที่ยังไม่ commit ใน `app/`, `components/`, `utils/`)
**อ้างอิงกฎธุรกิจ:** `Context.md` (Customer สร้างคำขอ, Companion รอรับงานและอัปเดตสถานะ, Admin จัดการผู้ใช้)
**หมายเหตุ:** รายงานนี้ยังไม่ได้แก้โค้ด ทุกข้อมีสถานการณ์ที่ทำให้ระบบทำงานผิดจริงกำกับไว้

---

## สรุปภาพรวม

| # | ระดับ | ไฟล์ | ประเด็น |
|---|---|---|---|
| 1 | High | `app/requests/new/page.tsx:68` | Companion ยังเข้าหน้าสร้างคำขอและเห็นปุ่มสร้างคำขอได้ทุกที่ |
| 2 | High | `app/my-requests/actions.ts:32` | `acceptServiceRequest` ไม่ตรวจว่าผู้ใช้เป็น Companion |
| 3 | High | `app/my-requests/actions.ts:84` | Companion คนอื่นแย่งคำขอที่เจาะจงถึง Companion อีกคนได้ |
| 4 | High | `app/my-requests/actions.ts:151` | ไม่มีการตรวจลำดับสถานะ เปลี่ยนสถานะย้อนหลังหรือข้ามขั้นได้ |
| 5 | High | `app/become-companion/actions.ts:73` | การเปลี่ยน role ผ่าน client ของผู้ใช้ บ่งชี้ว่า RLS ยอมให้ผู้ใช้แก้ role ตัวเอง |
| 6 | High | `app/become-companion/page.tsx:75` | Admin กดสมัครเป็น Companion แล้วเสียสิทธิ์ Admin |
| 7 | Medium | `app/my-requests/actions.ts:84` | รับงานพร้อมกันแล้วแพ้ แต่ระบบยังแจ้งว่า "ตอบรับสำเร็จ" |
| 8 | Medium | `app/my-requests/page.tsx:539` | ปุ่ม "ปฏิเสธงาน" ยกเลิกคำขอของลูกค้าทั้งใบ |
| 9 | Medium | `app/requests/new/actions.ts:51` | ไม่ตรวจ `companion_id` ฝั่ง server ทำให้คำขอค้างถาวรได้ |
| 10 | Medium | `app/admin/actions.ts:103` | ลด role Companion แล้วยังแสดงในหน้าค้นหาและงานที่รับไว้ค้าง |
| 11 | Medium | `app/requests/new/actions.ts:62` | `datetime-local` ถูกแปลงตาม timezone ของ server ทำให้เวลาผิด |
| 12 | Medium | `app/requests/new/actions.ts:120` | ข้อความ "สร้างคำขอสำเร็จ" ไม่แสดง เพราะชื่อพารามิเตอร์ไม่ตรงกัน |
| 13 | Low | `app/my-requests/page.tsx:148` | รหัส error หลายตัวไม่มีข้อความรองรับ ผู้ใช้จึงไม่เห็นว่าดำเนินการไม่สำเร็จ |
| 14 | Low | `app/my-requests/actions.ts:59` | คำขอที่เลยเวลานัดแล้วยังค้างเป็น pending และกดรับงานได้ |
| 15 | Low | `app/requests/new/actions.ts:79` | Server ไม่บังคับเพดาน `duration_hours` และ parse ค่าทศนิยมแบบเงียบ |

---

## รายละเอียด

### 1. [High] Companion ยังเข้าหน้าสร้างคำขอและเห็นปุ่มสร้างคำขอได้ทุกที่
**ไฟล์:** `app/requests/new/page.tsx:68`, `app/my-requests/page.tsx:305`, `app/my-requests/page.tsx:386`, `app/page.tsx:70`, `app/companions/page.tsx:129`, `app/companions/page.tsx:348`, `app/requests/new/actions.ts:39-42`

ตาม `Context.md` Companion ทำได้แค่รอรับงานและอัปเดตสถานะ แต่ตอนนี้ฝั่ง UI ยังเปิดทางให้ Companion ทำหน้าที่ของผู้ขอบริการ
- `NewRequestPage` ตรวจแค่ว่าล็อกอินแล้ว ไม่ตรวจ role จึงเปิดฟอร์มให้ Companion ได้เต็มรูปแบบ
- ปุ่ม "สร้างคำขอใหม่" ใน `/my-requests`, ปุ่ม CTA "สร้างคำขอรับบริการ" ในหน้าแรก, ปุ่ม "สร้างคำขอทั่วไป" และ "เลือกผู้ช่วยคนนี้" ใน `/companions` แสดงทุก role (Companion ยังเห็นการ์ดของตัวเองในรายชื่อผู้ช่วยด้วย)
- `/my-requests` ยังมีแท็บ "คำขอที่ฉันสร้างเอง" สำหรับ Companion
- ตัวป้องกันมีเพียงใน server action (`actions.ts:40`) ซึ่งทำงานหลังผู้ใช้กรอกฟอร์มครบแล้ว และ redirect ไป `/?error=companion_cannot_create_request` แต่หน้าแรกไม่อ่านพารามิเตอร์ `error`

**สถานการณ์:** Companion กด "สร้างคำขอใหม่" ใน `/my-requests` → กรอกฟอร์มครบ → กดส่ง → ถูกเด้งไปหน้าแรก ข้อมูลที่กรอกหายและไม่มีข้อความบอกเหตุผล
นอกจากนี้ตัวตรวจใน action ยังปล่อยผ่าน (fail-open) เมื่ออ่าน profile ไม่สำเร็จ เพราะ `profile?.role === "companion"` เป็น `false` เมื่อ `profile` เป็น `null`

**ข้อเสนอ:** ใส่ guard ตาม role ในหน้า `/requests/new` (redirect ก่อน render), ซ่อน CTA ทุกจุดเมื่อเป็น Companion, เอาแท็บ `customer_requests` ออกจากมุมมอง Companion และเปลี่ยน action ให้ยอมเฉพาะ `role === "customer"` แทนการบล็อก `companion` อย่างเดียว

### 2. [High] `acceptServiceRequest` ไม่ตรวจว่าผู้ใช้เป็น Companion
**ไฟล์:** `app/my-requests/actions.ts:32-56`

คอมเมนต์ข้อ 2 บอกว่าตรวจสิทธิ์ Companion แต่ในโค้ดไม่มีการ query `profiles.role` เลย Server Action เรียกตรงได้ด้วย action ID ที่อยู่ในหน้าเว็บ
**สถานการณ์:** Customer ส่ง POST ไปที่ action นี้พร้อม `request_id` ของคำขอคนอื่นที่เป็น pending → ระบบตั้ง `companion_id` เป็น Customer คนนั้นและเปลี่ยนเป็น `accepted` ถ้า RLS ไม่กันไว้ เจ้าของคำขอจะเห็นผู้ช่วยที่ไม่ใช่ Companion และได้เบอร์โทรของกันและกัน

### 3. [High] Companion คนอื่นแย่งคำขอที่เจาะจงถึง Companion อีกคนได้
**ไฟล์:** `app/my-requests/actions.ts:59-61`, `app/my-requests/actions.ts:84-91`

Action ตรวจแค่ `status === "pending"` ไม่ตรวจว่า `request.companion_id` เป็น `null` หรือเป็นตัวผู้ใช้เอง และ `update` กรองแค่ `.eq("status", "pending")`
**สถานการณ์:** Customer ส่งคำขอเจาะจงถึง Companion B → Companion A ได้ `request_id` แล้วส่ง form ไปที่ action → `companion_id` ถูกเขียนทับเป็น A คำขอที่ลูกค้าเลือก B ไว้กลายเป็นของ A
**ข้อเสนอ:** ตรวจ `request.companion_id == null || request.companion_id === user.id` และใส่เงื่อนไขเดียวกันใน `update` ด้วย `.or("companion_id.is.null,companion_id.eq.<uid>")`

### 4. [High] ไม่มีการตรวจลำดับสถานะ เปลี่ยนสถานะย้อนหลังหรือข้ามขั้นได้
**ไฟล์:** `app/my-requests/actions.ts:151-163`

สำหรับ `in_progress` และ `completed` ตรวจแค่ `isAssignedCompanion` ไม่ตรวจสถานะปัจจุบัน
**สถานการณ์:**
- Companion ส่ง `status=completed` ขณะงานยังเป็น `accepted` → ข้ามขั้น `in_progress`
- งานที่ `completed` แล้ว ส่ง `status=in_progress` ได้อีก (ย้อนสถานะ)
- Companion กด "ปฏิเสธงาน" (ข้อ 8) แล้ว `companion_id` ยังเป็นตัวเอง จึงส่ง `status=completed` กับคำขอที่ `cancelled` ไปแล้วได้ ทำให้สถิติใน Admin ผิด

**ข้อเสนอ:** กำหนดตาราง transition ที่อนุญาต เช่น `accepted→in_progress`, `in_progress→completed`, `pending|accepted→cancelled` และตรวจกับ `request.status` ก่อน update

### 5. [High] การเปลี่ยน role ผ่าน client ของผู้ใช้ บ่งชี้ว่า RLS ยอมให้ผู้ใช้แก้ role ตัวเอง
**ไฟล์:** `app/become-companion/actions.ts:73-76`

`registerAsCompanion` ใช้ `createClient()` (anon key และ session ของผู้ใช้) ทำ `update({ role: "companion" })` บนตาราง `profiles` ถ้าคำสั่งนี้สำเร็จ แปลว่า RLS policy ยอมให้ผู้ใช้ UPDATE แถวของตัวเองรวมถึงคอลัมน์ `role` ด้วย
**สถานการณ์:** ผู้ใช้ทั่วไปเปิด DevTools แล้วเรียก `supabase.from("profiles").update({ role: "admin" }).eq("id", myId)` ด้วย anon key ที่ฝังในหน้าเว็บ → ได้สิทธิ์ Admin และเข้า `/admin` ได้ (หน้า admin เชื่อค่า `profiles.role` อย่างเดียว)
**ข้อเสนอ:** ตรวจ RLS policy ใน Supabase ห้ามผู้ใช้แก้คอลัมน์ `role` (ใช้ column-level privilege หรือ trigger) และเปลี่ยน action นี้ไปใช้ `createAdminClient()` ที่ตั้งค่าได้เฉพาะ `companion`

### 6. [High] Admin กดสมัครเป็น Companion แล้วเสียสิทธิ์ Admin
**ไฟล์:** `app/become-companion/page.tsx:75`, `app/become-companion/actions.ts:48-81`

หน้า `/become-companion` บล็อกเฉพาะ `role === "companion"` ส่วน action ไม่ตรวจ role เลยก่อนเขียน `role: "companion"` ทับ
**สถานการณ์:** Admin (ซึ่งเป็น admin คนเดียวในระบบ) เปิด `/become-companion` จากหน้าแรกหรือพิมพ์ URL เองแล้วส่งฟอร์ม → role กลายเป็น `companion` และระบบไม่เหลือ Admin ทั้งที่ `updateUserRole` ป้องกัน self-demote ไว้แล้ว (`app/admin/actions.ts:65`)
**ข้อเสนอ:** อนุญาตเฉพาะ `role === "customer"` ทั้งในหน้าและใน action

### 7. [Medium] รับงานพร้อมกันแล้วแพ้ แต่ระบบยังแจ้งว่า "ตอบรับสำเร็จ"
**ไฟล์:** `app/my-requests/actions.ts:84-102` (และแบบเดียวกันที่ `:166-183`)

`.eq("status", "pending")` กัน race ได้ แต่ Supabase ไม่คืน error เมื่อ update แล้วไม่มีแถวถูกแก้ และโค้ดไม่ได้ `.select()` มาตรวจจำนวนแถว
**สถานการณ์:** Companion A และ B กดรับงานเดียวกันเกือบพร้อมกัน → B update ได้ 0 แถว แต่ไม่มี `updateError` → B ถูก redirect ไป `?success=accepted` เห็นข้อความ "ตอบรับงานเรียบร้อยแล้ว" แต่งานไม่อยู่ในแท็บ My Jobs
**ข้อเสนอ:** ใช้ `.select("id")` แล้วตรวจว่าได้แถวกลับมา ถ้าไม่ได้ให้ redirect ไป `error=already_taken`

### 8. [Medium] ปุ่ม "ปฏิเสธงาน" ยกเลิกคำขอของลูกค้าทั้งใบ
**ไฟล์:** `app/my-requests/page.tsx:539-551`, `app/my-requests/actions.ts:155-162`

ปุ่มปฏิเสธคำขอเจาะจงส่ง `status=cancelled` ทำให้คำขอของลูกค้าจบลงทันที `companion_id` ยังค้างเป็น Companion ที่ปฏิเสธ
**สถานการณ์:** Companion B ปฏิเสธเพราะไม่ว่าง → ลูกค้าเห็นแค่ "ยกเลิกคำขอแล้ว" โดยไม่รู้ว่าถูกปฏิเสธ คำขอไม่ถูกเปิดให้ Companion คนอื่นรับ ลูกค้าต้องสร้างใหม่ และ B ยังเปลี่ยนสถานะคำขอนี้ได้ต่อ (ข้อ 4)
**ข้อเสนอ:** การปฏิเสธควรคืน `companion_id = null` ให้คำขอกลับเป็น open request หรือมีสถานะ `rejected` แยก และแจ้งลูกค้า

### 9. [Medium] ไม่ตรวจ `companion_id` ฝั่ง server ทำให้คำขอค้างถาวรได้
**ไฟล์:** `app/requests/new/actions.ts:51`, `app/requests/new/actions.ts:92`, `app/requests/new/page.tsx:86-101`

Action รับ `companion_id` จาก hidden input แล้วบันทึกตรง ๆ ไม่ตรวจว่าเป็น Companion จริง, `is_available = true` หรือไม่ใช่ตัวผู้ใช้เอง ส่วนหน้า `/requests/new` ก็ไม่กรอง `is_available`
**สถานการณ์:** ลูกค้าเปิดลิงก์เก่า `/requests/new?companion_id=<X>` ของผู้ช่วยที่ปิดรับงานหรือถูกลด role ไปแล้ว (หรือแก้ hidden input เป็น UUID ของ Customer) → คำขอบันทึกได้ แต่ query ของแท็บ Open (`companion_id.is.null OR companion_id.eq.<uid>`) ไม่แสดงคำขอนี้ให้ Companion คนไหนเห็นเลย คำขอจึงค้าง `pending` ตลอดไป

### 10. [Medium] ลด role Companion แล้วยังแสดงในหน้าค้นหาและงานที่รับไว้ค้าง
**ไฟล์:** `app/admin/actions.ts:103-106`, `app/companions/page.tsx:88`

`updateUserRole` เปลี่ยนแค่ `profiles.role` ไม่แตะ `companion_profiles.is_available` และไม่จัดการงานที่ `accepted`/`in_progress` อยู่ ส่วน `/companions` กรองแค่ `is_available = true` ไม่ได้ join ตรวจ `profiles.role`
**สถานการณ์:** Admin ระงับ Companion คนหนึ่งโดยเปลี่ยนเป็น `customer` → ชื่อยังขึ้นใน `/companions` พร้อมป้าย "พร้อมรับงาน" ลูกค้าส่งคำขอเจาะจงไปแล้วค้างตามข้อ 9 และงานที่คนนั้นรับไว้แล้วก็ค้างเพราะแท็บ My Jobs ไม่แสดงให้ role `customer` จึงกด "เริ่มเดินทาง/สิ้นสุด" ไม่ได้
**ข้อเสนอ:** เมื่อลด role ให้ตั้ง `is_available = false` และคืนงานที่ยังไม่เสร็จกลับเป็น pending (หรือแจ้ง Admin) และให้ `/companions` กรอง `profiles.role = 'companion'` ด้วย

### 11. [Medium] `datetime-local` ถูกแปลงตาม timezone ของ server ทำให้เวลาผิด
**ไฟล์:** `app/requests/new/actions.ts:62-76`, `app/requests/new/actions.ts:96`

`<input type="datetime-local">` ส่งค่าแบบไม่มี timezone เช่น `2026-10-01T09:00` แล้ว `new Date(...)` ตีความตาม timezone ของ server (ปกติบน Vercel/Docker เป็น UTC)
**สถานการณ์:** ลูกค้าในไทยจองนัด 09:00 → บันทึกเป็น 09:00 UTC = 16:00 เวลาไทย หน้าแสดงผลจึงโชว์เวลานัดคลาดไป 7 ชั่วโมง การตรวจ `past_date` ก็คลาดไป 7 ชั่วโมงเช่นกัน (จองเวลาที่ผ่านไปแล้วภายใน 7 ชั่วโมงก่อนได้) และการตรวจชนตารางงานก็ใช้เวลาที่ผิด
**ข้อเสนอ:** ส่ง timezone offset จาก client มาด้วย หรือกำหนด `+07:00` ให้ชัดเจนก่อน parse

### 12. [Medium] ข้อความ "สร้างคำขอสำเร็จ" ไม่แสดง เพราะชื่อพารามิเตอร์ไม่ตรงกัน
**ไฟล์:** `app/requests/new/actions.ts:120`, `app/my-requests/page.tsx:137`

Action redirect ไป `/my-requests?created=success` แต่หน้า `/my-requests` อ่าน `success` แล้วเทียบกับค่า `"created"`
**สถานการณ์:** ลูกค้าสร้างคำขอสำเร็จทุกครั้งแต่ไม่เห็นข้อความยืนยัน
**ข้อเสนอ:** เปลี่ยนเป็น `redirect("/my-requests?success=created")`

### 13. [Low] รหัส error หลายตัวไม่มีข้อความรองรับ ผู้ใช้จึงไม่เห็นว่าดำเนินการไม่สำเร็จ
**ไฟล์:** `app/my-requests/page.tsx:148-155`, `app/page.tsx:13`

`getErrorMessage` ไม่รองรับ `schedule_conflict`, `missing_id`, `invalid_status`, `cannot_cancel` และหน้าแรกไม่อ่าน `error=companion_cannot_create_request` เลย
**สถานการณ์:** Companion กดรับงานที่เวลาชนกับงานเดิม → action redirect ไป `?error=schedule_conflict` → หน้าไม่แสดงอะไร ผู้ใช้คิดว่าปุ่มไม่ทำงานหรือไม่รู้ว่าทำไมรับงานไม่ได้

### 14. [Low] คำขอที่เลยเวลานัดแล้วยังค้างเป็น pending และกดรับงานได้
**ไฟล์:** `app/my-requests/actions.ts:59-61`, `app/my-requests/page.tsx:246-249`

ไม่มีกลไกหมดอายุ และทั้ง query แท็บ Open กับ action รับงานไม่ตรวจ `appointment_date` กับเวลาปัจจุบัน
**สถานการณ์:** คำขอนัดเมื่อวานที่ไม่มีใครรับยังขึ้นในแท็บ "งานที่รอผู้ช่วย" Companion กดรับได้ แล้วงานก็ขึ้นเป็น "ผู้ช่วยตอบรับแล้ว" ทั้งที่เลยเวลานัดไปแล้ว

### 15. [Low] Server ไม่บังคับเพดาน `duration_hours` และ parse ค่าทศนิยมแบบเงียบ
**ไฟล์:** `app/requests/new/actions.ts:79-85`

`max={24}` มีแค่ใน HTML ส่วน server ใช้ `parseInt` ซึ่งตัดทศนิยมทิ้ง
**สถานการณ์:** ส่ง `duration_hours=500` ตรงไปที่ action → บันทึกได้ ทำให้ Companion ที่รับงานนี้ถูกการตรวจชนตาราง (`actions.ts:63-81`) บล็อกไม่ให้รับงานอื่นไปประมาณ 3 สัปดาห์ ส่วน `2.5` ถูกบันทึกเป็น `2` โดยไม่แจ้งผู้ใช้

---

## ลำดับที่แนะนำให้แก้

1. ข้อ 5 (ตรวจ RLS ของ `profiles.role`) เพราะเสี่ยงให้ใครก็ได้ยกระดับตัวเองเป็น Admin
2. ข้อ 1, 2, 3, 4, 6: บังคับขอบเขต role และลำดับสถานะให้ตรงกับ `Context.md`
3. ข้อ 7 ถึง 12: ความถูกต้องของ flow และข้อมูล
4. ข้อ 13 ถึง 15: ข้อความแจ้งผู้ใช้และ validation เพิ่มเติม
