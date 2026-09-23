import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Supabase client dùng SERVICE ROLE KEY — bỏ qua TOÀN BỘ RLS và có quyền gọi
 * `auth.admin.*` (tạo/xoá tài khoản Supabase Auth). CHỈ được dùng trong Route
 * Handlers (`app/api/**`) chạy ở server Node.js, và LUÔN gọi `requireAdmin()`
 * (xem `server.ts`) để xác thực người gọi TRƯỚC khi tạo client này — không có
 * RLS nào chặn lại nếu bỏ qua bước xác thực đó.
 *
 * TUYỆT ĐỐI KHÔNG import file này vào bất kỳ "use client" component/hook
 * nào — biến `SUPABASE_SERVICE_ROLE_KEY` CỐ Ý không có tiền tố
 * `NEXT_PUBLIC_` để Next.js không inline nó vào bundle trình duyệt, nhưng
 * import sai chỗ (vào 1 file client) vẫn có thể vô tình kéo theo và làm lộ
 * key có toàn quyền trên database ra cho bất kỳ ai xem source bundle.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. Xem file .env.local.example."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
