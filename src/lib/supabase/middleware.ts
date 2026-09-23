import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

/**
 * Bảo vệ /staff/* và /admin/*: chưa đăng nhập -> /login; đã đăng nhập nhưng
 * không có role hợp lệ -> /login kèm thông báo lỗi; nhân viên (role='staff')
 * cố vào /admin -> đưa về khu vực của họ (/staff/tables). Chủ quán
 * (role='admin') được vào CẢ HAI khu vực.
 *
 * Dùng `supabase.auth.getUser()` (không dùng `getSession()`) vì đây là nơi
 * duy nhất xác thực lại token với Supabase Auth server — `getSession()` chỉ
 * đọc cookie tại chỗ, có thể bị giả mạo nếu không được xác thực lại.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Thiếu cấu hình env — không chặn request (tránh sập toàn bộ site nếu lỡ
    // deploy thiếu biến môi trường); trường hợp này /staff và /admin sẽ vẫn
    // gọi được Supabase từ phía client và tự báo lỗi thiếu cấu hình ở đó.
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isStaffRoute = pathname.startsWith("/staff");

  if (!isAdminRoute && !isStaffRoute) {
    return response;
  }

  function redirectTo(path: string, searchParam?: { key: string; value: string }): NextResponse {
    const url = new URL(path, request.url);
    if (searchParam) url.searchParams.set(searchParam.key, searchParam.value);
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo("/login", { key: "redirect", value: pathname });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;

  if (role !== "admin" && role !== "staff") {
    // Tài khoản có đăng nhập nhưng chưa được cấp hồ sơ role hợp lệ.
    return redirectTo("/login", { key: "error", value: "no-role" });
  }

  if (isAdminRoute && role !== "admin") {
    return redirectTo("/staff/tables");
  }

  return response;
}
