import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Màn hình quầy — Gọi Món",
  description: "Màn hình phụ dành cho khách hàng tại quầy thu ngân",
};

/**
 * Layout riêng cho `/counter/*` — CHỈ đặt metadata (page.tsx bên dưới phải là
 * Client Component vì dùng hook/state nên không tự export metadata được,
 * theo đúng ràng buộc của Next.js App Router). Không có nav/chrome gì thêm —
 * Màn hình phụ cần full-màn hình tuyệt đối, khác hẳn `/staff`/`/admin`.
 */
export default function CounterLayout({ children }: { children: ReactNode }) {
  return children;
}
