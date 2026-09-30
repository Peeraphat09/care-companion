# 🤝 Care Companion

> **เว็บแอปพลิเคชันแพลตฟอร์มกลางเชื่อมโยงผู้ที่ต้องการผู้ช่วยร่วมเดินทาง (Customer) กับผู้ให้บริการร่วมเดินทาง (Companion)**
> รายวิชา: Assignment + Midterm — พัฒนา Web Application by Next.js

---

## 📖 ที่มาและแนวคิดโครงการ

ผู้สูงอายุ ผู้ที่เดินทางคนเดียวไม่สะดวก หรือผู้ที่ต้องการความช่วยเหลือ มักลำบากเมื่อสมาชิกในครอบครัวไม่สามารถเดินทางไปด้วยได้ เช่น ไปพบแพทย์ตามนัด ไปโรงพยาบาล ไปธนาคาร ติดต่อหน่วยงานราชการ ซื้อสินค้า หรือทำธุระอื่นนอกบ้าน

**Care Companion** เป็นตัวกลางเชื่อม:
1. **Customer** — ผู้ที่ต้องการผู้ช่วยร่วมเดินทางไปทำธุระ
2. **Companion** — ผู้ให้บริการช่วยเหลือและอำนวยความสะดวกในการเดินทางและการทำธุระ
3. **Admin** — ผู้บริหารจัดการภาพรวมแพลตฟอร์มและข้อมูลผู้ใช้

> ⚠️ **ข้อจำกัดสำคัญ:** Companion มีหน้าที่ช่วยเหลือและอำนวยความสะดวกในการเดินทางและทำธุระเท่านั้น **ไม่ใช่ผู้ให้บริการทางการแพทย์ และไม่ใช่ผู้ดูแลรักษาผู้ป่วย**

---

## ✨ ฟีเจอร์หลัก

### ทุกคน (ไม่ต้องล็อกอิน)
- ดูข้อมูลเบื้องต้นของแพลตฟอร์มที่หน้าแรก
- ดูรายชื่อและโปรไฟล์ Companion ที่เปิดรับงาน พร้อมค้นหา (เฉพาะข้อมูลที่เหมาะสมต่อการเผยแพร่)

### Customer (ผู้ใช้บริการ)
- เข้าสู่ระบบด้วย Google Account
- ค้นหา/เลือก Companion ที่เหมาะสม หรือสร้างคำขอแบบเปิดให้ผู้ช่วยคนใดก็ได้รับ
- ระบุความต้องการ: ประเภทธุระ, วัน-เวลา, สถานที่ต้นทาง, จุดหมาย, ระยะเวลา, รายละเอียดเพิ่มเติม
- ติดตามสถานะคำขอ และยกเลิกได้ก่อนเริ่มให้บริการ
- สมัครเป็น Companion ได้

### Companion (ผู้ช่วยร่วมเดินทาง)
- เข้าสู่ระบบด้วย Google Account และนำเสนอโปรไฟล์: ประสบการณ์, ทักษะ, พื้นที่ให้บริการ, วัน/เวลาที่สะดวก
- ดูคำขอที่เปิดรอผู้ช่วย ตอบรับงาน (หรือปฏิเสธคำขอที่เจาะจงถึงตน)
- อัปเดตสถานะ: ตอบรับ → เริ่มเดินทาง → สิ้นสุดบริการ (ระบบตรวจงานเวลาซ้อนทับ)
- Companion เป็นฝั่งผู้ให้บริการ **ไม่สร้างคำขอรับบริการ**

### Admin (ผู้ดูแลระบบ)
- แดชบอร์ดสถิติผู้ใช้และคำขอ
- เปลี่ยนสิทธิ์ผู้ใช้ (Customer / Companion / Admin)
- ตรวจสอบคำขอรับบริการทั้งหมด

### วงจรบริการ
```
pending → accepted → in_progress → completed
   └────────(ยกเลิก)──────┴──→ cancelled
```

> รายละเอียดกฎธุรกิจ สคีมา และตารางเทียบข้อกำหนดของโจทย์ อยู่ใน [`Context.md`](./Context.md) — รายงานตรวจสอบโค้ด/ความปลอดภัยอยู่ใน [`review.md`](./review.md)

---

## 🛠️ เทคโนโลยีที่ใช้ (ตามที่โจทย์กำหนด)

| ส่วน | เทคโนโลยี |
| :-- | :-- |
| Frontend / Full Stack | Next.js 16 (App Router, TypeScript) + Tailwind CSS v4 |
| Authentication | Google Account ผ่าน Supabase Authentication |
| Database | Supabase PostgreSQL (เปิด RLS ทุกตาราง) |
| File Storage | Supabase Storage (bucket `companion-files`) |
| Deployment | Vercel |
| Icons | lucide-react |

---

## 🚀 การติดตั้งและรันในเครื่อง

1. Clone และติดตั้ง
   ```bash
   git clone <your-repo-url>
   cd care-companion-app
   npm install
   ```
2. สร้างไฟล์ `.env.local`
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # ความลับ ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
   ```
3. ตั้งค่า Supabase
   - สร้างตาราง `profiles`, `companion_profiles`, `service_requests` ตามสคีมาใน `Context.md` และเปิด RLS พร้อมกำหนด Policy
   - เปิด Google Provider ที่ Authentication → Providers และเพิ่ม Redirect URL `http://localhost:3000/auth/callback`
   - สร้าง Storage bucket `companion-files`
4. รัน
   ```bash
   npm run dev      # http://localhost:3000
   npm run build    # ตรวจ build ก่อน deploy
   npm run lint
   ```
5. ตั้งผู้ดูแลระบบคนแรก: ล็อกอินด้วย Google หนึ่งครั้ง แล้วแก้ `profiles.role` เป็น `admin` ใน Supabase

---

## ☁️ Deploy บน Vercel

1. Import รีโพเข้า Vercel และตั้ง Environment Variables ทั้ง 3 ตัวข้างต้น
2. เพิ่มโดเมน Vercel ใน Supabase → Authentication → URL Configuration (Site URL และ Redirect URL `https://<domain>/auth/callback`) และใน Google Cloud Console (Authorized redirect URIs)
3. ทดสอบ flow เต็มบน production: ล็อกอิน → สร้างคำขอ → Companion รับงาน → จบงาน → ดูใน Admin

---

## 📌 สถานะการพัฒนา

| ส่วน | สถานะ |
| :-- | :-- |
| Auth (Google), Navbar, หน้าแรก | ✅ |
| ค้นหา Companion, สมัครเป็น Companion | ✅ |
| สร้างคำขอ, ตอบรับ, เปลี่ยนสถานะ, ยกเลิก | ✅ (มีข้อบกพร่องที่ต้องแก้ ดู `review.md`) |
| Admin Dashboard และจัดการ Role | ✅ |
| Supabase Storage (รูป/เอกสาร Companion) | ❌ ยังไม่ได้เชื่อมกับโค้ด |
| แก้ไขโปรไฟล์ Companion / สวิตช์ `is_available` | ❌ |
| Deploy บน Vercel | ⏳ |
