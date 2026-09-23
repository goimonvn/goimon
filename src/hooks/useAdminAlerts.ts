"use client";

import { notifyStaff } from "@/lib/notify";
import { subscribeToNewFeedbacksAlert } from "@/services/feedback.service";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Bộ lắng nghe toàn cục cho toàn bộ khu vực /admin: chuông + rung + toast khi
 * có ĐÁNH GIÁ MỚI từ khách, bất kể chủ quán đang mở trang nào trong khu vực
 * quản trị (Tổng quan, Quản lý menu...), không chỉ riêng trang
 * `/admin/feedbacks` — mirror đúng mô hình `useStaffAlerts` đã dùng cho khu
 * vực /staff (Module 2), đặt một lần ở layout để tránh đăng ký trùng lặp
 * kênh realtime khi chuyển trang.
 */
export function useAdminAlerts(): void {
  useEffect(() => {
    const feedbackChannel = subscribeToNewFeedbacksAlert(() => {
      notifyStaff();
      toast.info("Có đánh giá mới từ khách hàng!");
    });

    return () => {
      void feedbackChannel.unsubscribe();
    };
  }, []);
}
