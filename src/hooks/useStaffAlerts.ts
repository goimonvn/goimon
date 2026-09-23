"use client";

import { notifyStaff } from "@/lib/notify";
import { subscribeToNewOrders } from "@/services/order.service";
import { subscribeToNewStaffCalls } from "@/services/staffCall.service";
import { STAFF_CALL_LABEL } from "@/types";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Bộ lắng nghe toàn cục cho toàn bộ khu vực /staff: phát chuông + rung + toast
 * khi có ĐƠN MỚI từ khách hoặc YÊU CẦU HỖ TRỢ MỚI, bất kể nhân viên đang mở
 * trang KDS, quản lý bàn hay hết món nhanh. Đặt một lần ở layout để tránh
 * đăng ký trùng lặp nhiều kênh realtime khi chuyển trang.
 */
export function useStaffAlerts(): void {
  useEffect(() => {
    const orderChannel = subscribeToNewOrders(() => {
      notifyStaff();
      toast.info("Có đơn hàng mới từ khách!");
    });

    const staffCallChannel = subscribeToNewStaffCalls((call) => {
      notifyStaff();
      toast.info(`Yêu cầu mới: ${STAFF_CALL_LABEL[call.request_type]}`);
    });

    return () => {
      void orderChannel.unsubscribe();
      void staffCallChannel.unsubscribe();
    };
  }, []);
}
