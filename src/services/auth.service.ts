import { supabase } from "@/lib/supabase/client";
import { AppError } from "@/types";
import type { ProfilesRow } from "@/types/database.types";
import type { User } from "@supabase/supabase-js";

export interface CurrentUser {
  user: User;
  profile: ProfilesRow;
}

/** Đăng nhập bằng email/mật khẩu cho tài khoản nhân viên/chủ quán. Không có luồng đăng ký công khai. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new AppError("Email hoặc mật khẩu không đúng.", error);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AppError("Không thể đăng xuất. Vui lòng thử lại.", error);
  }
}

/**
 * Lấy user + hồ sơ role đang đăng nhập, hoặc null nếu chưa đăng nhập HOẶC đã
 * đăng nhập nhưng chưa được cấp hồ sơ role hợp lệ (tài khoản Auth tồn tại mà
 * không có dòng `profiles` tương ứng — hiếm khi xảy ra vì có trigger tự tạo,
 * nhưng vẫn xử lý an toàn thay vì để lỗi mơ hồ).
 */
export async function getCurrentProfile(): Promise<CurrentUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể tải hồ sơ người dùng.", error);
  }
  if (!profile) return null;

  return { user, profile };
}
