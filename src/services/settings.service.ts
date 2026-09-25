import { supabase } from "@/lib/supabase/client";
import { AppError } from "@/types";
import type { PaymentConfigValue } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Key duy nhất hiện đang dùng trong bảng key/value `system_settings` (Module 17). */
const PAYMENT_CONFIG_KEY = "payment_config";

/**
 * Mặc định AN TOÀN NHẤT khi vì lý do gì đó chưa đọc được dòng cấu hình thật
 * (vd quên chạy lại schema.sql sau khi kéo code mới) — BẬT CẢ 4, tức là giữ
 * nguyên hành vi thanh toán hiện có của quán, giống hệt cách `getShopSettings`
 * (Module 6) fail-open thay vì fail-closed: 1 cấu hình đọc lỗi không được
 * phép làm khách/nhân viên KHÔNG CÒN cách nào thanh toán.
 */
const DEFAULT_PAYMENT_CONFIG: PaymentConfigValue = {
  enable_payos: true,
  enable_static_qr: true,
  enable_cash: true,
  enable_pay_at_table: true,
};

/**
 * Đọc cấu hình bật/tắt phương thức thanh toán — dùng ở cả khách (`CheckoutSheet`,
 * anon, đọc qua policy "Public read system_settings"), nhân viên
 * (`PaymentConfirmSheet`/`TableDetailSheet`) lẫn trang cấu hình của chủ quán
 * (`/admin/settings`). Dùng `{ ...DEFAULT, ...value }` (không trả thẳng
 * `data.value`) để tự vá nếu sau này thêm cờ mới vào `PaymentConfigValue` mà
 * dòng cũ trong database chưa có field đó — tránh `undefined` rò rỉ ra UI.
 */
export async function getPaymentSettings(): Promise<PaymentConfigValue> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", PAYMENT_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể tải cấu hình thanh toán.", error);
  }

  return { ...DEFAULT_PAYMENT_CONFIG, ...(data?.value ?? {}) };
}

/** Chỉ admin gọi được (xem policy "Admin update system_settings") — ghi đè TOÀN BỘ giá trị JSONB bằng object mới. */
export async function updatePaymentSettings(value: PaymentConfigValue): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", PAYMENT_CONFIG_KEY);

  if (error) {
    throw new AppError("Không thể cập nhật cấu hình thanh toán.", error);
  }
}

/**
 * Realtime — khách đang xem `/order/status` hoặc nhân viên đang mở
 * `/staff/tables` tự thấy đúng lựa chọn thanh toán ngay khi admin đổi cấu
 * hình ở `/admin/settings`, không cần tải lại trang. Lọc theo đúng
 * `key=eq.payment_config` (dù hiện chỉ có 1 dòng) để không refetch thừa nếu
 * sau này bảng có thêm key khác.
 */
export function subscribeToPaymentSettingsChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:system_settings:payment_config")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "system_settings", filter: `key=eq.${PAYMENT_CONFIG_KEY}` },
      () => onChange()
    )
    .subscribe();
}
