import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Supabase client dùng trong Route Handlers (app/api/**) chạy ở server
 * Node.js — đọc phiên đăng nhập từ cookie (next/headers) để XÁC THỰC người
 * gọi trước khi thực hiện hành động nhạy cảm (vd: mở kết nối TCP tới máy in
 * nội bộ ở route /api/print/lan).
 *
 * QUAN TRỌNG: middleware.ts chỉ bảo vệ `/staff/:path*` và `/admin/:path*`,
 * KHÔNG bao gồm `/api/**` — mọi Route Handler dưới `/api` phải tự kiểm tra
 * quyền bằng client này, nếu không sẽ để lộ hành động cho khách ẩn danh gọi
 * thẳng API (ví dụ dùng route in để dò/tấn công mạng LAN nội bộ của quán).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route Handler chỉ ĐỌC phiên để xác thực, không cần refresh token
          // tại đây (khác middleware.ts) nên bỏ qua việc ghi lại cookie.
        },
      },
    }
  );
}

/** true nếu người gọi hiện tại đã đăng nhập với role 'admin' hoặc 'staff'. */
export async function requireStaffOrAdmin(): Promise<boolean> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" || profile?.role === "staff";
}

/** true nếu người gọi hiện tại đã đăng nhập với role 'admin' — dùng cho các Route Handler quản trị tài khoản nhân viên (`/api/admin/staff/**`, Module 4 mở rộng), CHỈ chủ quán mới được thêm/xoá/đổi role tài khoản. */
export async function requireAdmin(): Promise<boolean> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin";
}

/** id của người gọi hiện tại (null nếu chưa đăng nhập) — dùng để chặn admin tự xoá chính mình ở `/api/admin/staff/[id]`. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
