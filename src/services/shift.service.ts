import { supabase } from "@/lib/supabase/client";
import { AppError, type ShiftWithStaff } from "@/types";
import type { CloseShiftResultRow, ShiftsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Ca làm việc ĐANG MỞ của nhân viên hiện đang đăng nhập (nếu có). Dùng để:
 * (1) quyết định hiển thị nút "Bắt đầu ca" hay "Kết thúc ca" ở `StaffNav`,
 * (2) gắn `shift_id` khi xác nhận thanh toán (xem order.service.markOrdersPaid).
 * Trả về `null` nếu chưa đăng nhập hoặc chưa có ca nào đang mở — KHÔNG ném lỗi
 * trong 2 trường hợp này vì đây là trạng thái bình thường, không phải sự cố.
 */
export async function getActiveShiftForCurrentStaff(): Promise<ShiftsRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("staff_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể kiểm tra ca làm việc hiện tại.", error);
  }
  return data;
}

/**
 * Bắt đầu ca mới cho nhân viên đang đăng nhập.
 *
 * Chủ động kiểm tra trước (pre-check) xem đã có ca đang mở hay chưa để trả về
 * thông báo lỗi thân thiện — ràng buộc THẬT SỰ đảm bảo "mỗi nhân viên chỉ có
 * tối đa 1 ca đang mở" nằm ở unique index `idx_shifts_one_active_per_staff`
 * (partial unique index, xem schema.sql), pre-check này chỉ để tránh lỗi
 * Postgres khó hiểu hiện ra cho người dùng trong tình huống thông thường
 * (race condition thật sự vẫn được DB chặn, dù hiếm khi xảy ra ở quy mô 1
 * nhân viên tự bấm nút trên 1 thiết bị).
 */
export async function startShift(initialCash: number): Promise<ShiftsRow> {
  if (initialCash < 0) {
    throw new AppError("Tiền đầu ca không được âm.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Vui lòng đăng nhập lại trước khi bắt đầu ca.");
  }

  const existing = await getActiveShiftForCurrentStaff();
  if (existing) {
    throw new AppError("Bạn đang có một ca làm việc chưa kết thúc.");
  }

  // An toàn để .select().single() ở đây (khác staff_calls/feedbacks ở Module 7):
  // policy "Staff select own shifts" cho phép staff SELECT đúng dòng của mình.
  const { data, error } = await supabase
    .from("shifts")
    .insert({ staff_id: user.id, initial_cash: initialCash })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể bắt đầu ca làm việc. Vui lòng thử lại.", error);
  }
  return data;
}

/**
 * Kết thúc ca — gọi RPC `close_shift` để tính tổng doanh thu tiền mặt/chuyển
 * khoản và số đơn đã thu tiền trong ca MỘT LẦN, NGUYÊN TỬ, ngay tại Postgres
 * (xem giải thích trong schema.sql). Trả về đầy đủ dữ liệu cho bảng "Báo cáo
 * chốt ca".
 */
export async function closeShift(shiftId: string, finalCash: number): Promise<CloseShiftResultRow> {
  if (finalCash < 0) {
    throw new AppError("Tiền mặt thực đếm không được âm.");
  }

  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_final_cash: finalCash,
  });

  if (error) {
    throw new AppError("Không thể kết thúc ca làm việc. Vui lòng thử lại.", error);
  }

  const result = data?.[0];
  if (!result) {
    throw new AppError("Ca làm việc không tồn tại hoặc đã được kết thúc trước đó.");
  }
  return result;
}

/**
 * Toàn bộ lịch sử ca làm việc kèm tên nhân viên — dùng cho `/admin/shifts`, mới nhất trước.
 *
 * Từ Module 14, `shifts` có 2 khoá ngoại riêng biệt tới `profiles`
 * (`staff_id` VÀ `edited_by`) nên PHẢI chỉ rõ tên ràng buộc (`!<fkey>`) ở mỗi
 * embed — nếu không, PostgREST không tự biết embed nào ứng với cột nào, sẽ
 * báo lỗi "more than one relationship was found". Tên ràng buộc theo đúng quy
 * ước đặt tên mặc định của Postgres cho FK 1 cột: `<table>_<column>_fkey`.
 */
export async function getShiftHistory(): Promise<ShiftWithStaff[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select(
      "*, staff:profiles!shifts_staff_id_fkey(full_name, email), editor:profiles!shifts_edited_by_fkey(full_name, email)"
    )
    .order("start_time", { ascending: false });

  if (error) {
    throw new AppError("Không thể tải lịch sử ca làm việc.", error);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed.
  type RawRow = ShiftsRow & {
    staff: { full_name: string | null; email: string } | null;
    editor: { full_name: string | null; email: string } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map(({ staff, editor, ...rest }) => ({
    ...rest,
    staffName: staff?.full_name || staff?.email || "Không rõ",
    editorName: editor ? editor.full_name || editor.email : null,
  }));
}

/**
 * (Chủ quán, Module 14) Đóng ca HỘ 1 nhân viên đã quên bấm "Kết thúc ca" —
 * gọi LẠI ĐÚNG RPC `close_shift` (tính doanh thu tiền mặt/chuyển khoản
 * NGUYÊN TỬ từ `orders`, giống hệt luồng nhân viên tự đóng ca), chỉ khác:
 * chủ quán gọi được cho BẤT KỲ ca nào (nhờ policy "Admin update any shift")
 * và bắt buộc nhập `note` giải trình lý do — RPC tự ghi vào `admin_note`/
 * `edited_by`/`edited_at` để có dấu vết ai đã can thiệp và vì sao.
 */
export async function adminCloseShift(
  shiftId: string,
  finalCash: number,
  note: string
): Promise<CloseShiftResultRow> {
  if (finalCash < 0) {
    throw new AppError("Tiền mặt thực đếm không được âm.");
  }
  if (!note.trim()) {
    throw new AppError("Vui lòng nhập lý do đóng ca hộ.");
  }

  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_final_cash: finalCash,
    p_admin_note: note.trim(),
  });

  if (error) {
    throw new AppError("Không thể đóng ca hộ. Vui lòng thử lại.", error);
  }

  const result = data?.[0];
  if (!result) {
    throw new AppError("Ca làm việc không tồn tại hoặc đã được kết thúc trước đó.");
  }
  return result;
}

export interface AdminShiftCashEdit {
  initialCash: number;
  /** `null` khi ca đang mở (chưa có số để sửa) — giữ nguyên `final_cash = null` hiện có. */
  finalCash: number | null;
}

/**
 * (Chủ quán, Module 14) Sửa lại "Tiền đầu ca"/"Tiền mặt thực đếm" của 1 ca —
 * dùng khi nhân viên gõ nhầm lúc bắt đầu ca, hoặc đếm nhầm tiền lúc chốt ca.
 * CỐ Ý KHÔNG cho sửa `total_revenue_cash`/`total_revenue_transfer` qua đường
 * này (2 cột đó luôn được tính lại đúng từ `orders` trong `close_shift`,
 * sửa tay sẽ làm sai lệch số liệu gốc). Bắt buộc nhập `note` giải trình lý
 * do, ghi cùng lúc vào `admin_note`/`edited_by`/`edited_at`.
 */
export async function adminUpdateShiftCash(
  shiftId: string,
  edit: AdminShiftCashEdit,
  note: string
): Promise<void> {
  if (edit.initialCash < 0) {
    throw new AppError("Tiền đầu ca không được âm.");
  }
  if (edit.finalCash !== null && edit.finalCash < 0) {
    throw new AppError("Tiền mặt thực đếm không được âm.");
  }
  if (!note.trim()) {
    throw new AppError("Vui lòng nhập lý do chỉnh sửa.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AppError("Vui lòng đăng nhập lại.");
  }

  const { error } = await supabase
    .from("shifts")
    .update({
      initial_cash: edit.initialCash,
      final_cash: edit.finalCash,
      admin_note: note.trim(),
      edited_by: user.id,
      edited_at: new Date().toISOString(),
    })
    .eq("id", shiftId);

  if (error) {
    throw new AppError("Không thể cập nhật ca làm việc.", error);
  }
}

/** Realtime: Admin thấy ngay khi có ca mới bắt đầu/kết thúc, không cần refresh trang. */
export function subscribeToShiftChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:shifts")
    .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => onChange())
    .subscribe();
}
