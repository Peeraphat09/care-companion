import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // อนุญาตให้ Server Action รับไฟล์รูปโปรไฟล์ (จำกัดไฟล์ละ 2MB ในโค้ด) — ค่าเริ่มต้นคือ 1MB
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
