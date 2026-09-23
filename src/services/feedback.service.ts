import { supabase } from "@/lib/supabase/client";
import { AppError, type FeedbackInput, type FeedbackWithOrder } from "@/types";
import type { FeedbacksRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { notifyNewFeedbackTelegram } from "./telegram.service";

/** Kiểm tra order đã được đánh giá chưa — dùng để tránh hiện lại form đánh giá cho đơn đã gửi. */
export async function getFeedbackForOrder(orderId: string): Promise<FeedbacksRow | null> {
  const { data, error } = await supabase
    .from("feedbacks")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể kiểm tra trạng thái đánh giá.", error);
  }
  return data;
}

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const { error } = await supabase.from("feedbacks").insert({
    order_id: input.orderId,
    rating_beverage: input.ratingBeverage,
    rating_service: input.ratingService,
    rating_space: input.ratingSpace,
    comment: input.comment.trim() || null,
  });

  if (error) {
    throw new AppError("Không thể gửi đánh giá. Vui lòng thử lại.", error);
  }

  notifyNewFeedbackTelegram(
    input.tableNumber ?? null,
    { ratingBeverage: input.ratingBeverage, ratingService: input.ratingService, ratingSpace: input.ratingSpace },
    input.comment.trim() || null
  );
}

/** Toàn bộ đánh giá kèm thông tin đơn/bàn gốc — dùng cho /admin/feedbacks, mới nhất trước. */
export async function getAllFeedbacks(): Promise<FeedbackWithOrder[]> {
  const { data, error } = await supabase
    .from("feedbacks")
    .select("*, order:orders(total_amount, table:tables(table_number))")
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Không thể tải danh sách đánh giá.", error);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed.
  type RawRow = FeedbacksRow & {
    order: { total_amount: number; table: { table_number: number } | null } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map(({ order, ...rest }) => ({
    ...rest,
    order: order ? { total_amount: order.total_amount, table_number: order.table?.table_number ?? null } : null,
  }));
}

/** Realtime: chủ quán nhận ngay khi có đánh giá mới, không cần refresh trang. */
export function subscribeToNewFeedbacks(onInsert: () => void): RealtimeChannel {
  return supabase
    .channel("public:feedbacks")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "feedbacks" }, () => onInsert())
    .subscribe();
}

/**
 * Riêng cho hệ thống cảnh báo toàn cục của khu vực /admin (`useAdminAlerts`,
 * Module 7) — kênh TÊN RIÊNG (khác `subscribeToNewFeedbacks` ở trên) dù cùng
 * lắng nghe 1 sự kiện, theo đúng quy ước đã dùng cho staff_calls/orders
 * (`subscribeToNewStaffCalls`/`subscribeToNewOrders` — hậu tố `:alert`): tách
 * kênh "để bắn chuông toàn cục" khỏi kênh "để 1 trang cụ thể tự refetch danh
 * sách", tránh phụ thuộc chéo giữa 2 mục đích dùng khác nhau.
 */
export function subscribeToNewFeedbacksAlert(onInsert: () => void): RealtimeChannel {
  return supabase
    .channel("public:feedbacks:alert")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "feedbacks" }, () => onInsert())
    .subscribe();
}
