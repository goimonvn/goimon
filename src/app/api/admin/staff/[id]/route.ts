import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Xoá tài khoản nhân viên/chủ quán — BẮT BUỘC service role
 * (`auth.admin.deleteUser`), cascade xoá luôn dòng `profiles` tương ứng (FK
 * `on delete cascade`, xem schema.sql). Xoá là hành động KHÔNG THỂ HOÀN TÁC
 * nên 2 lớp bảo vệ dưới đây bắt buộc chạy Ở SERVER (không thể chỉ chặn ở
 * UI): không cho tự xoá chính mình (tránh tự khoá mình khỏi phiên đang
 * dùng), không cho xoá chủ quán CUỐI CÙNG còn lại (nếu không quán sẽ mất
 * quyền truy cập `/admin` vĩnh viễn, chỉ khôi phục được bằng cách sửa thẳng
 * trong Supabase Dashboard).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const authorized = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Chỉ chủ quán mới được xoá tài khoản." }, { status: 401 });
  }

  const targetId = params.id;
  const callerId = await getCurrentUserId();
  if (callerId === targetId) {
    return NextResponse.json({ error: "Không thể tự xoá tài khoản của chính mình." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Không thể kiểm tra tài khoản trước khi xoá." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Tài khoản không tồn tại." }, { status: 404 });
  }

  if (target.role === "admin") {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      return NextResponse.json(
        { error: "Không thể kiểm tra số lượng chủ quán trước khi xoá." },
        { status: 500 }
      );
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Không thể xoá chủ quán cuối cùng — quán sẽ mất quyền truy cập trang quản trị." },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    return NextResponse.json({ error: "Không thể xoá tài khoản. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
