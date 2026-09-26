"use client";

import { CounterIdleScreen } from "@/components/counter/CounterIdleScreen";
import { CounterPaymentScreen } from "@/components/counter/CounterPaymentScreen";
import { CounterReviewScreen } from "@/components/counter/CounterReviewScreen";
import { CounterSuccessScreen } from "@/components/counter/CounterSuccessScreen";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { useCounterDisplay } from "@/hooks/useCounterDisplay";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useEffect } from "react";

/**
 * Màn hình phụ dành cho khách hàng tại quầy thu ngân (Module 16) — mở sẵn
 * LIÊN TỤC trên 1 tablet/màn hình đặt quay về phía khách tại quầy, KHÔNG có
 * nút bấm/thao tác nào (khách chỉ xem) — Self-Kiosk (khách tự chọn món ngay
 * trên màn hình này) để version sau, xem quyết định phạm vi ở
 * `tinh-trang-du-an.md` Module 16.
 *
 * Không yêu cầu đăng nhập — giống mọi trang khách hàng khác trong dự án
 * (`/order/*`) — vì trang này thuần HIỂN THỊ, không có hành động ghi dữ liệu
 * nào xuất phát từ chính trang này; toàn bộ điều khiển đến từ broadcast của
 * thu ngân ở `/staff/tables` (xem hooks/useCounterDisplay.ts).
 */
export default function CounterDisplayPage() {
  usePageTitle("Màn hình quầy");
  const { screen, tableId, tableNumber, paymentInfo, successInfo } = useCounterDisplay();

  // Chỉ tải/lắng nghe đơn của bàn khi thật sự cần hiển thị nội dung món
  // (review/payment) — truyền null lúc idle/success để useActiveOrders tự
  // dọn dẹp subscription, đúng chữ ký hook đã có (Module 1).
  const showOrderContent = screen === "review" || screen === "payment";
  const { orders, loading } = useActiveOrders(showOrderContent ? tableId : null);

  // Chặn thiết bị tự khoá màn hình sau 1 thời gian không chạm — quan trọng
  // vì đây là màn hình CHỈ HIỂN THỊ, khách không bao giờ chạm vào. Tự bỏ qua
  // nếu trình duyệt/thiết bị không hỗ trợ Wake Lock API (không dùng type
  // `WakeLockSentinel` có sẵn của TypeScript để tránh phụ thuộc vào đúng bản
  // `lib.dom.d.ts` — ép kiểu cấu trúc thủ công, an toàn với mọi phiên bản).
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;

    async function requestWakeLock() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        // Bỏ qua — không phải mọi trình duyệt/thiết bị đều hỗ trợ Wake Lock API,
        // màn hình vẫn hoạt động bình thường, chỉ là có thể tự khoá theo cài đặt
        // riêng của thiết bị nếu không có tương tác trong thời gian dài.
      }
    }

    void requestWakeLock();
    return () => {
      void wakeLock?.release();
    };
  }, []);

  if (screen === "review" && tableNumber !== null) {
    return <CounterReviewScreen tableNumber={tableNumber} orders={orders} loading={loading} />;
  }

  if (screen === "payment" && tableNumber !== null && paymentInfo) {
    return (
      <CounterPaymentScreen
        tableNumber={tableNumber}
        amount={paymentInfo.amount}
        qrImageUrl={paymentInfo.qrImageUrl}
      />
    );
  }

  if (screen === "success" && successInfo) {
    return <CounterSuccessScreen orderCode={successInfo.orderCode} amount={successInfo.amount} />;
  }

  return <CounterIdleScreen />;
}
