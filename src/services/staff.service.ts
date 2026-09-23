import { supabase } from "@/lib/supabase/client";
import { AppError, type StaffAccountFormInput } from "@/types";
import type { ProfilesRow, UserRole } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Toàn bộ tài khoản nhân viên/chủ quán — RLS chỉ cho `admin` đọc đầy đủ ("Admin read profiles", xem schema.sql); nhân viên thường chỉ đọc được hồ sơ của chính mình. */
export async function getAllStaffAccounts(): Promise<ProfilesRow[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách tài khoản.", error);
  }
  return data ?? [];
}

/**
 * Tạo tài khoản nhân viên/chủ quán mới — gọi qua Route Handler server-side
 * (`/api/admin/staff`) vì tạo user Supabase Auth CẦN service role key, không
 * thể làm trực tiếp từ trình duyệt (xem `lib/supabase/admin.ts`).
 */
export async function createStaffAccount(input: StaffAccountFormInput): Promise<void> {
  const response = await fetch("/api/admin/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? "Không thể tạo tài khoản mới.");
  }
}

/**
 * Đổi role — chỉ là UPDATE cột `profiles.role` bình thường (KHÔNG cần service
 * role, khác createStaffAccount/deleteStaffAccount ở trên vì không đụng tới
 * `auth.users`). CHẶN đổi role của CHÍNH MÌNH ngay ở đây để admin không lỡ
 * tay tự hạ quyền rồi tự khoá mình khỏi toàn bộ khu vực `/admin` trong
 * chính phiên đang dùng — đây là kiểm tra CLIENT, chỉ ngăn thao tác lỡ tay
 * qua UI (giống nhiều đánh đổi tin cậy client khác đã ghi nhận trong dự
 * án), không phải hàng rào bảo mật; hàng rào thật sự cho việc XOÁ (hành
 * động không thể hoàn tác) nằm ở server, xem `/api/admin/staff/[id]`.
 */
export async function updateStaffRole(staffId: string, role: UserRole): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === staffId) {
    throw new AppError("Không thể tự đổi vai trò của chính mình.");
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", staffId);

  if (error) {
    throw new AppError("Không thể cập nhật vai trò.", error);
  }
}

/**
 * Xoá tài khoản — gọi qua Route Handler server-side (cùng lý do
 * createStaffAccount, cần `auth.admin.deleteUser`). Server tự chặn xoá
 * CHÍNH MÌNH và xoá chủ quán CUỐI CÙNG còn lại (xem route.ts) — 2 lớp bảo vệ
 * này bắt buộc phải ở SERVER vì xoá không thể hoàn tác.
 */
export async function deleteStaffAccount(staffId: string): Promise<void> {
  const response = await fetch(`/api/admin/staff/${staffId}`, { method: "DELETE" });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? "Không thể xoá tài khoản.");
  }
}

/** Realtime — bảng danh sách tự cập nhật khi có tài khoản mới/xoá hoặc role vừa đổi. */
export function subscribeToStaffAccountChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:profiles:staff")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => onChange())
    .subscribe();
}
