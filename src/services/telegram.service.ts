import type { TelegramNotifyPayload, TelegramOrderItemSummary } from "@/types";
import type { StaffCallRequestType } from "@/types/database.types";

/**
 * Gửi thông báo Telegram cho quán — LUÔN "bắn rồi quên" (fire-and-forget):
 * gọi route nội bộ `/api/notify/telegram` (route này mới là nơi giữ
 * TELEGRAM_BOT_TOKEN và gọi Telegram API thật, xem route.ts), không bao giờ
 * `await` ở nơi gọi và không bao giờ ném lỗi ra ngoài — thông báo Telegram là
 * tiện ích cộng thêm, một request Telegram lỗi/timeout/quán chưa cấu hình bot
 * KHÔNG được phép làm gián đoạn luồng nghiệp vụ chính (đặt món, gọi nhân
 * viên, gửi đánh giá).
 */
function postTelegramNotification(payload: TelegramNotifyPayload): void {
  void fetch("/api/notify/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Lỗi mạng/route — bỏ qua lặng lẽ, xem JSDoc ở trên.
  });
}

/** Báo quán có đơn hàng mới từ 1 bàn, kèm danh sách món để chủ quán nắm ngay không cần mở app. */
export function notifyNewOrderTelegram(
  tableNumber: number,
  items: TelegramOrderItemSummary[],
  totalAmount: number
): void {
  postTelegramNotification({ type: "new_order", tableNumber, items, totalAmount });
}

/**
 * Báo quán có đơn ĐẶT MANG ĐI mới (Module 13) — kèm tên/SĐT khách và giờ hẹn
 * lấy để quán chủ động chuẩn bị, khác với `notifyNewOrderTelegram` (đơn ăn tại
 * bàn) vì không có số bàn mà thay bằng thông tin liên hệ của khách.
 */
export function notifyNewTakeawayOrderTelegram(
  customerName: string,
  customerPhone: string,
  pickupTime: string | null,
  items: TelegramOrderItemSummary[],
  totalAmount: number
): void {
  postTelegramNotification({
    type: "new_takeaway_order",
    customerName,
    customerPhone,
    pickupTime,
    items,
    totalAmount,
  });
}

/** Báo quán khách vừa gọi nhân viên / xin đá / yêu cầu thanh toán ở 1 bàn. */
export function notifyStaffCallTelegram(tableNumber: number, requestType: StaffCallRequestType): void {
  postTelegramNotification({ type: "staff_call", tableNumber, requestType });
}

/** Báo quán có đánh giá mới từ khách (kèm điểm 3 hạng mục + nhận xét nếu có). */
export function notifyNewFeedbackTelegram(
  tableNumber: number | null,
  ratings: { ratingBeverage: number; ratingService: number; ratingSpace: number },
  comment: string | null
): void {
  postTelegramNotification({ type: "new_feedback", tableNumber, ...ratings, comment });
}

/**
 * Báo quán 1 nguyên liệu vừa xuống mức sắp/đã hết (stock_quantity <=
 * min_threshold) NGAY SAU KHI trừ kho tự động — Module 12, gọi từ
 * inventory.service.checkAndDeductInventoryForOrderItem. Cũng "bắn rồi quên"
 * như mọi thông báo Telegram khác trong dự án (xem JSDoc postTelegramNotification).
 */
export function notifyLowStockTelegram(
  ingredientName: string,
  stockQuantity: number,
  unit: string,
  minThreshold: number
): void {
  postTelegramNotification({ type: "low_stock", ingredientName, stockQuantity, unit, minThreshold });
}
