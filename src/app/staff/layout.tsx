"use client";

import { StaffNav } from "@/components/staff/StaffNav";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useStaffAlerts } from "@/hooks/useStaffAlerts";
import type { ReactNode } from "react";

/**
 * Layout dùng chung cho toàn bộ khu vực /staff (KDS, quản lý bàn, hết món nhanh).
 * useStaffAlerts được gọi Ở ĐÂY (một lần duy nhất) để nhân viên luôn nhận được
 * chuông/rung khi có đơn mới hoặc yêu cầu hỗ trợ mới, bất kể đang ở trang nào.
 *
 * Việc CHẶN truy cập khi chưa đăng nhập (hoặc sai vai trò) do `middleware.ts`
 * đảm nhiệm ở tầng server trước khi trang này được render — `useCurrentProfile`
 * ở đây chỉ để hiển thị tên/vai trò + nút đăng xuất trên header.
 */
export default function StaffLayout({ children }: { children: ReactNode }) {
  useStaffAlerts();
  const { profile, signOut } = useCurrentProfile();

  return (
    <div className="min-h-dvh bg-muted/30 print:bg-white">
      <div className="print:hidden">
        <StaffNav profile={profile} onLogout={signOut} />
      </div>
      <div className="mx-auto max-w-5xl p-4 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
