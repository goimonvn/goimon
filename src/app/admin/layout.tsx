"use client";

import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminAlerts } from "@/hooks/useAdminAlerts";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import type { ReactNode } from "react";

/**
 * Layout dùng chung cho khu vực /admin (Dashboard, quản lý menu, hoá đơn VAT).
 * Tối ưu cho màn hình PC/Tablet nên dùng max-width rộng hơn khu vực /staff.
 *
 * Việc CHẶN truy cập khi chưa đăng nhập hoặc không phải vai trò 'admin' do
 * `middleware.ts` đảm nhiệm ở tầng server trước khi trang này được render —
 * `useCurrentProfile` ở đây chỉ để hiển thị tên/vai trò + nút đăng xuất.
 *
 * `useAdminAlerts` (Module 7) đặt Ở ĐÂY (một lần duy nhất, giống
 * `useStaffAlerts` ở staff/layout.tsx) để chủ quán luôn nhận chuông/rung/toast
 * khi có đánh giá mới, bất kể đang xem trang nào trong khu vực quản trị.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  useAdminAlerts();
  const { profile, signOut } = useCurrentProfile();

  return (
    <div className="min-h-dvh bg-muted/30">
      <AdminNav profile={profile} onLogout={signOut} />
      <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
    </div>
  );
}
