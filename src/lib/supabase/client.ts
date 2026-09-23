import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Ném lỗi sớm ngay khi build/khởi chạy thay vì lỗi mơ hồ lúc gọi API.
  throw new Error(
    "Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Xem file .env.local.example."
  );
}

/**
 * Supabase client dùng ở phía trình duyệt (client component). Là singleton để
 * tránh mở nhiều kết nối realtime trùng lặp.
 *
 * Từ Module 4 (Auth), dùng `createBrowserClient` của `@supabase/ssr` thay vì
 * `createClient` thường: client này lưu phiên đăng nhập vào COOKIE (thay vì
 * chỉ localStorage), để `middleware.ts` (chạy ở server/edge, không truy cập
 * được localStorage của trình duyệt) đọc được phiên đăng nhập và chặn truy
 * cập /staff, /admin khi chưa đăng nhập đúng vai trò. Với khách quét QR
 * (không bao giờ đăng nhập) hành vi hoàn toàn không đổi.
 */
export const supabase: SupabaseClient<Database> = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
