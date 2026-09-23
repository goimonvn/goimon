import { formatCurrency } from "@/lib/utils";
import type { PromotionPreview } from "@/types";
import type { PromotionsRow } from "@/types/database.types";

/** Chuẩn hoá mã giảm giá khách nhập (khoảng trắng + hoa/thường) để so khớp nhất quán với mã lưu trong DB. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Nhãn ngắn gọn hiển thị mức giảm, ví dụ "10%" hoặc "20.000đ" — dùng chung ở giỏ hàng và bảng quản trị. */
export function formatDiscountLabel(promotion: Pick<PromotionsRow, "discount_type" | "discount_value">): string {
  return promotion.discount_type === "percentage"
    ? `${promotion.discount_value}%`
    : formatCurrency(promotion.discount_value);
}

function isWithinDailyWindow(promotion: PromotionsRow, now: Date): boolean {
  if (!promotion.daily_start_time || !promotion.daily_end_time) return true;
  // So sánh dạng chuỗi "HH:MM:SS" — đúng vì luôn zero-pad 2 chữ số theo thứ tự
  // giờ->phút->giây. CHƯA hỗ trợ khung giờ qua đêm (vd 22:00 -> 02:00, khi đó
  // daily_start_time > daily_end_time) — xem ghi chú trong schema.sql.
  const currentTime = now.toTimeString().slice(0, 8);
  return currentTime >= promotion.daily_start_time && currentTime <= promotion.daily_end_time;
}

/**
 * Xem trước 1 khuyến mãi có áp dụng được cho giỏ hàng hiện tại không — dùng
 * để hiển thị NGAY trên giỏ hàng (Module 1) mà không cần round-trip server.
 * Đây CHỈ là bản xem trước cho UI: RPC `redeem_promotion` ở server luôn kiểm
 * tra lại TOÀN BỘ điều kiện này một lần nữa (nguồn xác thực cuối cùng) lúc
 * gửi đơn — xem order.service.createOrder.
 */
export function previewPromotionDiscount(
  promotion: PromotionsRow,
  subtotal: number,
  now: Date = new Date()
): PromotionPreview {
  if (!promotion.is_active) {
    return { eligible: false, discountAmount: 0, reason: "Mã giảm giá này đã ngừng áp dụng." };
  }
  if (now < new Date(promotion.start_time) || now > new Date(promotion.end_time)) {
    return { eligible: false, discountAmount: 0, reason: "Mã giảm giá đã hết hạn hoặc chưa tới thời gian áp dụng." };
  }
  if (!isWithinDailyWindow(promotion, now)) {
    return { eligible: false, discountAmount: 0, reason: "Mã giảm giá chỉ áp dụng trong khung giờ vàng." };
  }
  if (promotion.usage_limit !== null && promotion.times_used >= promotion.usage_limit) {
    return { eligible: false, discountAmount: 0, reason: "Mã giảm giá đã hết lượt sử dụng." };
  }
  if (subtotal < promotion.min_order_value) {
    return {
      eligible: false,
      discountAmount: 0,
      reason: `Đơn hàng cần tối thiểu ${formatCurrency(promotion.min_order_value)} để áp dụng mã này.`,
    };
  }

  const rawDiscount =
    promotion.discount_type === "percentage" ? (subtotal * promotion.discount_value) / 100 : promotion.discount_value;

  return { eligible: true, discountAmount: Math.min(Math.round(rawDiscount), subtotal), reason: null };
}
