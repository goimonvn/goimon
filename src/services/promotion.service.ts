import { normalizePromoCode } from "@/lib/promotions";
import { supabase } from "@/lib/supabase/client";
import { AppError, type PromotionFormInput } from "@/types";
import type { PromotionsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Tra cứu mã giảm giá khách tự nhập ở giỏ hàng — trả `null` nếu không tồn tại
 * HOẶC không còn hiệu lực (RLS đã lọc sẵn theo is_active + khoảng thời gian,
 * xem schema.sql), khớp UX "mã không hợp lệ" chung, không phân biệt lý do cụ
 * thể để tránh lộ thông tin (mã đã hết hạn khác mã chưa từng tồn tại).
 */
export async function findPromotionByCode(code: string): Promise<PromotionsRow | null> {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;

  const { data, error } = await supabase.from("promotions").select("*").eq("code", normalized).maybeSingle();

  if (error) {
    throw new AppError("Không thể kiểm tra mã giảm giá. Vui lòng thử lại.", error);
  }
  return data;
}

/** Khuyến mãi TỰ ĐỘNG áp dụng (Happy Hour, không cần mã) đang còn hiệu lực — RLS đã lọc theo is_active + khoảng thời gian, xem schema.sql. */
export async function getAutoApplicablePromotions(): Promise<PromotionsRow[]> {
  const { data, error } = await supabase.from("promotions").select("*").eq("requires_code", false);

  if (error) {
    throw new AppError("Không thể tải khuyến mãi tự động.", error);
  }
  return data ?? [];
}

/**
 * Áp dụng khuyến mãi NGUYÊN TỬ qua RPC `redeem_promotion` — server kiểm tra
 * lại toàn bộ điều kiện (còn hạn/đúng khung giờ/đủ giá trị tối thiểu/còn lượt)
 * và TỰ TÍNH số tiền giảm, không tin tưởng bất kỳ phép tính nào đã làm ở
 * client trước đó (xem lib/promotions.ts#previewPromotionDiscount). Trả về
 * số tiền giảm THẬT SỰ được ghi nhận. `error.message` ở đây chính là nội
 * dung tiếng Việt mà hàm SQL `raise exception` (an toàn để hiển thị thẳng).
 */
export async function redeemPromotion(promotionId: string, orderSubtotal: number): Promise<number> {
  const { data, error } = await supabase.rpc("redeem_promotion", {
    p_promotion_id: promotionId,
    p_order_subtotal: orderSubtotal,
  });

  if (error || data === null) {
    throw new AppError(error?.message || "Không thể áp dụng mã giảm giá.", error);
  }
  return data;
}

/**
 * Hoàn lại 1 lượt dùng khuyến mãi khi tạo đơn thất bại SAU KHI đã redeem (xem
 * order.service.createOrder) — tránh lãng phí 1 lượt của khách cho 1 đơn
 * không thành công. Gọi như một hành động BÙ TRỪ tốt-nhất-có-thể: caller tự
 * bọc try/catch, lỗi ở bước này không được phép che lấp lỗi gốc đã khiến đơn
 * thất bại.
 */
export async function releasePromotionUsage(promotionId: string): Promise<void> {
  const { error } = await supabase.rpc("release_promotion_usage", { p_promotion_id: promotionId });

  if (error) {
    throw new AppError("Không thể hoàn lại lượt dùng khuyến mãi.", error);
  }
}

// ---------------------------------------------------------------------------
// Quản trị (Admin) — /admin/promotions
// ---------------------------------------------------------------------------

/** Toàn bộ khuyến mãi (kể cả đã tắt/hết hạn) — dùng cho /admin/promotions, RLS chỉ cho phép admin đọc đầy đủ. */
export async function getAllPromotions(): Promise<PromotionsRow[]> {
  const { data, error } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Không thể tải danh sách khuyến mãi.", error);
  }
  return data ?? [];
}

function toPromotionRow(input: PromotionFormInput) {
  return {
    code: input.requiresCode ? normalizePromoCode(input.code ?? "") : null,
    description: input.description,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    min_order_value: input.minOrderValue,
    start_time: input.startTime,
    end_time: input.endTime,
    daily_start_time: input.dailyStartTime,
    daily_end_time: input.dailyEndTime,
    requires_code: input.requiresCode,
    usage_limit: input.usageLimit,
  };
}

export async function createPromotion(input: PromotionFormInput): Promise<PromotionsRow> {
  const { data, error } = await supabase.from("promotions").insert(toPromotionRow(input)).select("*").single();

  if (error || !data) {
    throw new AppError("Không thể tạo khuyến mãi mới. Mã giảm giá có thể đã tồn tại.", error);
  }
  return data;
}

export async function updatePromotionDetails(promotionId: string, input: PromotionFormInput): Promise<void> {
  const { error } = await supabase.from("promotions").update(toPromotionRow(input)).eq("id", promotionId);

  if (error) {
    throw new AppError("Không thể cập nhật khuyến mãi.", error);
  }
}

/** Bật/tắt nhanh 1 khuyến mãi từ bảng danh sách, không cần mở form đầy đủ. */
export async function setPromotionActive(promotionId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("promotions").update({ is_active: isActive }).eq("id", promotionId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái khuyến mãi.", error);
  }
}

export async function deletePromotion(promotionId: string): Promise<void> {
  const { error } = await supabase.from("promotions").delete().eq("id", promotionId);

  if (error) {
    throw new AppError("Không thể xoá khuyến mãi.", error);
  }
}

/** Realtime: bảng /admin/promotions tự cập nhật số lượt đã dùng ngay khi có khách áp dụng mã. */
export function subscribeToPromotionChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:promotions")
    .on("postgres_changes", { event: "*", schema: "public", table: "promotions" }, () => onChange())
    .subscribe();
}
