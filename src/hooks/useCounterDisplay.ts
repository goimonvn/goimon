"use client";

import { subscribeToCounterDisplayEvents } from "@/services/counterDisplay.service";
import { getOrderPaymentStatus } from "@/services/order.service";
import { useEffect, useState } from "react";

/** 4 trạng thái UI của Màn hình phụ (Module 16) — xem JSDoc `useCounterDisplay` bên dưới. */
export type CounterDisplayScreen = "idle" | "review" | "payment" | "success";

interface PaymentInfo {
  orderId: string;
  orderCode: number;
  amount: number;
  qrImageUrl: string;
}

interface SuccessInfo {
  orderCode: number;
  amount: number;
}

interface UseCounterDisplayResult {
  screen: CounterDisplayScreen;
  tableId: string | null;
  tableNumber: number | null;
  paymentInfo: PaymentInfo | null;
  successInfo: SuccessInfo | null;
}

/** Sau khi vào "success", tự quay về "idle" sau chừng này (không cần thu ngân thao tác gì thêm). */
const SUCCESS_AUTO_IDLE_MS = 5000;
/** Tần suất polling xác nhận thanh toán — giống hệt CheckoutSheet (Module 15), xem giải thích ở effect bên dưới. */
const PAYMENT_POLL_INTERVAL_MS = 3000;

/**
 * Quản lý toàn bộ máy trạng thái của Màn hình phụ tại quầy (Module 16):
 *
 *   idle -(thu ngân bấm "Hiện lên màn hình phụ" ở `/staff/tables`, broadcast
 *   ORDER_UPDATED)-> review -(thu ngân bấm "Thanh toán qua màn hình phụ",
 *   broadcast PAYMENT_STARTED)-> payment -(webhook PayOS xác nhận, PHÁT HIỆN
 *   bằng polling — xem effect bên dưới)-> success -(tự động sau
 *   `SUCCESS_AUTO_IDLE_MS`)-> idle.
 *
 * Bất kỳ bước nào cũng có thể bị ngắt về "review" (chọn bàn khác) hoặc "idle"
 * (broadcast ORDER_CLEARED) — không có bước nào là "điểm không thể quay
 * lại". Nội dung món ở "review" KHÔNG lấy từ payload broadcast — trang gọi
 * `useCounterDisplay` tự dùng thêm `useActiveOrders(tableId)` (đúng hook đã
 * dùng cho khách, Module 1) để tải/lắng nghe realtime, xem JSDoc
 * `CounterDisplayEvent` ở types/index.ts.
 */
export function useCounterDisplay(): UseCounterDisplayResult {
  const [screen, setScreen] = useState<CounterDisplayScreen>("idle");
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  // Lắng nghe broadcast từ thu ngân — kênh giữ SUỐT vòng đời trang (Màn hình
  // phụ chỉ có đúng 1 trang này, không cần huỷ/mở lại theo điều kiện nào).
  useEffect(() => {
    const channel = subscribeToCounterDisplayEvents((event) => {
      if (event.type === "ORDER_UPDATED") {
        setScreen("review");
        setTableId(event.tableId);
        setTableNumber(event.tableNumber);
        setPaymentInfo(null);
        setSuccessInfo(null);
      } else if (event.type === "PAYMENT_STARTED") {
        setScreen("payment");
        setTableId(event.tableId);
        setTableNumber(event.tableNumber);
        setPaymentInfo({
          orderId: event.orderId,
          orderCode: event.orderCode,
          amount: event.amount,
          qrImageUrl: event.qrImageUrl,
        });
        setSuccessInfo(null);
      } else {
        setScreen("idle");
        setTableId(null);
        setTableNumber(null);
        setPaymentInfo(null);
        setSuccessInfo(null);
      }
    });

    return () => {
      void channel.unsubscribe();
    };
  }, []);

  // Đường "CHẮC CHẮN" phát hiện thanh toán xong: polling trực tiếp
  // payment_status của đúng đơn đang chờ mỗi 3 giây, KHÔNG đi qua Realtime —
  // áp dụng đúng bài học đã rút ra ở Module 15 (CheckoutSheet): dự án có rất
  // nhiều kênh Realtime KHÔNG LỌC trên toàn bộ bảng `orders` phía nhân
  // viên/chủ quán (`useTables`, `useAnalyticsReport`, `useSmartInsights`,
  // `useDashboardSummary`, `useRevenueSeries`), có thể "cướp" mất sự kiện của
  // kênh khác bất kỳ lúc nào (bug đã biết của Supabase Realtime bản hosted,
  // xem https://github.com/supabase/realtime/issues/1524). Màn hình phụ này
  // lại càng dễ gặp vì luôn mở liên tục tại quầy suốt giờ quán mở cửa — KHÔNG
  // dựa thêm vào `useActiveOrders`/broadcast để phát hiện thanh toán xong,
  // chỉ dùng polling làm nguồn xác nhận DUY NHẤT cho bước payment -> success.
  useEffect(() => {
    if (screen !== "payment" || !paymentInfo) return;

    const { orderId, orderCode, amount } = paymentInfo;
    let cancelled = false;
    const interval = setInterval(() => {
      void getOrderPaymentStatus(orderId)
        .then((result) => {
          if (cancelled || result?.payment_status !== "paid") return;
          setScreen("success");
          setSuccessInfo({ orderCode, amount });
          setPaymentInfo(null);
        })
        .catch(() => {
          // Bỏ qua — thử lại ở lượt poll kế tiếp.
        });
    }, PAYMENT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen, paymentInfo]);

  // Tự quay về "idle" sau vài giây khi vào "success", không cần ai thao tác.
  useEffect(() => {
    if (screen !== "success") return;
    const timeout = setTimeout(() => {
      setScreen("idle");
      setTableId(null);
      setTableNumber(null);
      setPaymentInfo(null);
      setSuccessInfo(null);
    }, SUCCESS_AUTO_IDLE_MS);
    return () => clearTimeout(timeout);
  }, [screen]);

  return { screen, tableId, tableNumber, paymentInfo, successInfo };
}
