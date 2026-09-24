import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// SERVICE ROLE KEY (createSupabaseAdminClient) + fetch ra Telegram (route báo
// cáo cùng module) — cùng runtime "nodejs" như mọi Route Handler dùng secret
// phía server khác trong dự án (xem /api/notify/telegram, /api/print/lan).
export const runtime = "nodejs";

/**
 * Reset "còn hàng" (is_available = true) mỗi sáng cho các món có
 * `auto_reset_daily = true` (Module 12, xem schema.sql). Được Vercel Cron gọi
 * theo lịch trong `vercel.json` — KHÔNG có phiên đăng nhập nhân viên nào lúc
 * cron chạy, nên PHẢI dùng service role client (bỏ qua RLS) thay vì client
 * thường (chỉ staff/admin đã đăng nhập mới được UPDATE menu_items, xem
 * policy "Staff update menu_items" trong schema.sql).
 *
 * BẢO MẬT: route này CHỈ chạy khi có đúng `CRON_SECRET` trong header
 * Authorization — Vercel Cron tự động đính kèm `Bearer <CRON_SECRET>` cho mọi
 * lời gọi cron của chính nó khi biến môi trường này đã được cấu hình (xem
 * .env.local.example + tài liệu Vercel Cron Jobs). Thiếu đúng secret (kể cả
 * chưa cấu hình CRON_SECRET) sẽ bị từ chối — không có "chế độ mở" nào ở đây vì
 * route dùng service role, bỏ qua toàn bộ RLS.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleReset(): Promise<NextResponse> {
  const supabase = createSupabaseAdminClient();

  // Ép kiểu `as any` ngay sau .from("menu_items") — cùng lý do đã ghi chú ở
  // /api/admin/staff/route.ts: Database type viết tay khiến TypeScript suy
  // luận sai tham số của .update() trên client tạo bằng createClient thuần
  // (lib/supabase/admin.ts), sụp thành kiểu `never` dù dữ liệu truyền vào
  // đúng shape. Không ảnh hưởng runtime, chỉ là hạn chế suy luận kiểu.
  const { data, error } = await (supabase.from("menu_items") as any)
    .update({ is_available: true })
    .eq("auto_reset_daily", true)
    .eq("is_available", false)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resetCount: data?.length ?? 0 });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handleReset();
}

// Cho phép gọi thủ công bằng POST (vd để test bằng curl) — cùng logic, cùng yêu cầu xác thực.
export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}
