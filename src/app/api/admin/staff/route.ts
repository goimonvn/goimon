import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// Bắt buộc Node.js runtime (không phải Edge) — service role client cần thư
// viện auth.admin.* đầy đủ của @supabase/supabase-js, giống quy ước đã dùng
// cho mọi Route Handler dùng secret phía server trong dự án.
export const runtime = "nodejs";

interface CreateStaffBody {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "staff";
}

function isValidBody(value: unknown): value is CreateStaffBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.email === "string" &&
    body.email.includes("@") &&
    typeof body.password === "string" &&
    body.password.length >= 6 &&
    typeof body.fullName === "string" &&
    (body.role === "admin" || body.role === "staff")
  );
}

/**
 * Tạo tài khoản nhân viên/chủ quán mới — thay thế thao tác thủ công qua
 * Supabase Dashboard. BẮT BUỘC chạy ở server vì cần
 * `auth.admin.createUser` (service role key, xem `lib/supabase/admin.ts`) —
 * RLS không áp dụng cho bảng `auth.users` nội bộ của Supabase nên không có
 * cách nào làm việc này an toàn từ trình duyệt. `email_confirm: true` xác
 * nhận email ngay lúc tạo — khác tài khoản tạo thủ công qua Dashboard (cần
 * tự bật "Auto Confirm User"/tắt "Confirm email" mới đăng nhập được ngay,
 * xem README) — tài khoản tạo qua đây luôn đăng nhập được ngay lập tức.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authorized = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Chỉ chủ quán mới được tạo tài khoản mới." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai định dạng email/mật khẩu (tối thiểu 6 ký tự)/vai trò." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const email = body.email.trim().toLowerCase();
  const fullName = body.fullName.trim();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const isDuplicate = createError?.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: isDuplicate ? "Email này đã có tài khoản." : "Không thể tạo tài khoản. Vui lòng thử lại." },
      { status: 400 }
    );
  }

  // Trigger handle_new_user (schema.sql) đã tự tạo dòng profiles với role mặc
  // định 'staff' và full_name null NGAY TRONG CÙNG transaction insert user —
  // cập nhật lại đúng role/tên đã chọn ngay sau đó bằng client service role
  // (bỏ qua RLS, an toàn vì đã xác thực requireAdmin() ở trên).
  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: body.role, full_name: fullName || null })
    .eq("id", created.user.id);

  if (updateError) {
    return NextResponse.json(
      {
        error:
          "Đã tạo tài khoản nhưng không thể gán đúng vai trò/tên — vào Supabase Dashboard để sửa lại thủ công.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
