import { supabase } from "@/lib/supabase/client";
import { AppError, type CustomerIdentity, type LoyaltyHistoryEntry } from "@/types";
import type { CustomersRow, LoyaltyTransactionsRow } from "@/types/database.types";

function toIdentity(row: CustomersRow, isNew: boolean): CustomerIdentity {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    points: row.points,
    totalSpent: row.total_spent,
    isNew,
  };
}

/**
 * Tra cứu khách hàng thân thiết theo SĐT; nếu chưa từng có, tự động đăng ký
 * mới với 0 điểm. Gọi ở bước giỏ hàng (Module 1) trước khi gửi đơn — xem
 * ghi chú bảo mật (không xác thực OTP) ở schema.sql phần Module 5.
 */
export async function findOrCreateCustomerByPhone(
  phone: string,
  name?: string
): Promise<CustomerIdentity> {
  const normalizedPhone = phone.trim();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (findError) {
    throw new AppError("Không thể tra cứu thông tin khách hàng thân thiết.", findError);
  }

  if (existing) {
    return toIdentity(existing, false);
  }

  const { data: created, error: createError } = await supabase
    .from("customers")
    .insert({ phone: normalizedPhone, name: name?.trim() || null })
    .select("*")
    .single();

  if (createError || !created) {
    throw new AppError("Không thể đăng ký thành viên mới. Vui lòng thử lại.", createError);
  }

  return toIdentity(created, true);
}

/** Lấy thông tin điểm hiện tại của khách (dùng để làm mới widget sau khi thanh toán xong). */
export async function getCustomerById(customerId: string): Promise<CustomerIdentity | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();

  if (error) {
    throw new AppError("Không thể tải thông tin điểm thưởng.", error);
  }
  return data ? toIdentity(data, false) : null;
}

/** Lịch sử tích điểm của một khách — mới nhất trước, dùng cho widget "Xem lịch sử". */
export async function getLoyaltyHistory(customerId: string): Promise<LoyaltyHistoryEntry[]> {
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new AppError("Không thể tải lịch sử tích điểm.", error);
  }

  return ((data ?? []) as LoyaltyTransactionsRow[]).map((row) => ({
    id: row.id,
    points_change: row.points_change,
    reason: row.reason,
    created_at: row.created_at,
    orderShortId: row.order_id ? row.order_id.slice(0, 8).toUpperCase() : null,
  }));
}
