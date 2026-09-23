import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Bảo vệ toàn bộ khu vực /staff và /admin bằng phiên đăng nhập Supabase Auth.
 * Khu vực /order (khách quét QR) KHÔNG đi qua middleware này — luôn công khai
 * theo đúng thiết kế (khách không đăng nhập).
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/staff/:path*", "/admin/:path*"],
};
