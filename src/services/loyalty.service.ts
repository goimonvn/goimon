import { supabase } from "@/lib/supabase/client";
import { AppError } from "@/types";

/**
 * Cộng điểm thưởng cho khách sau khi nhân viên xác nhận thanh toán — gọi RPC
 * `award_loyalty_points` (Postgres function) để cộng điểm NGUYÊN TỬ, tránh
 * race-condition đọc-sửa-ghi nếu 2 lượt thanh toán của cùng 1 khách xảy ra
 * gần như đồng thời. Xem chi tiết trong schema.sql phần Module 5.
 *
 * Lỗi ở bước này KHÔNG được chặn luồng xác nhận thanh toán chính (tiền đã thu
 * là sự thật quan trọng nhất) — caller (order.service.markOrdersPaid) chủ động
 * bắt lỗi riêng cho từng lượt cộng điểm.
 */
export async function awardLoyaltyPoints(
  customerId: string,
  orderId: string,
  points: number,
  amount: number
): Promise<void> {
  if (points <= 0) return;

  const { error } = await supabase.rpc("award_loyalty_points", {
    p_customer_id: customerId,
    p_order_id: orderId,
    p_points: points,
    p_amount: amount,
  });

  if (error) {
    throw new AppError("Không thể cộng điểm thưởng cho khách hàng.", error);
  }
}
