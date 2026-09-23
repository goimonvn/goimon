import { createBrowserClient } from "@supabase/ssr";
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
 *
 * KHÔNG khai báo tường minh kiểu trả về (vd `: SupabaseClient<Database>`) —
 * để TypeScript tự suy luận thẳng từ `createBrowserClient<Database>(...)`.
 * Dự án không khoá phiên bản `@supabase/supabase-js`/`@supabase/ssr` (không
 * có package-lock.json, xem README/hướng dẫn deploy), nên mỗi lần Vercel
 * chạy `npm install` có thể kéo về một bản vá mới hơn với HÌNH DẠNG generic
 * hơi khác cho `SupabaseClient<...>` (đã từng gãy build vì lý do này — annotate
 * tường minh theo hình dạng cũ sẽ không còn khớp). Suy luận trực tiếp từ hàm
 * khởi tạo luôn khớp 100% với phiên bản thư viện thực tế được cài, bất kể nó
 * thay đổi hình dạng generic nội bộ ra sao.
 */
export const supabase = createBrowserClient<Database>(
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
