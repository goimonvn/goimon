import { supabase } from "@/lib/supabase/client";
import type { ReservationFormValues } from "@/lib/validation";
import { AppError, type ReservationWithTable } from "@/types";
import type { ReservationsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { notifyNewReservationTelegram } from "./telegram.service";

/**
 * Khách TỰ đặt qua link công khai `/dat-ban` (anon, không đăng nhập) — LUÔN
 * tạo ở trạng thái 'pending', không gán bàn (khớp đúng policy RLS "Public
 * insert reservations": `created_by is null and status = 'pending' and
 * table_id is null`, xem schema.sql). Quán cần tự gọi lại xác nhận, nên bắn
 * kèm thông báo Telegram (fire-and-forget, giống mọi thông báo khác trong dự
 * án) để không bị bỏ sót.
 */
export async function createReservation(input: ReservationFormValues): Promise<void> {
  const { error } = await supabase.from("reservations").insert({
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    party_size: input.partySize,
    reservation_time: new Date(input.reservationTime).toISOString(),
    note: input.note || null,
  });

  if (error) {
    throw new AppError("Không thể gửi yêu cầu đặt bàn. Vui lòng thử lại.", error);
  }

  notifyNewReservationTelegram(
    input.customerName,
    input.customerPhone,
    input.partySize,
    new Date(input.reservationTime).toISOString(),
    input.note || null
  );
}

/**
 * Nhân viên/chủ quán tạo hộ khi khách gọi điện tới quán (`/staff/reservations`)
 * — tạo THẲNG ở trạng thái 'confirmed' vì đang nói chuyện trực tiếp với khách,
 * không cần bước gọi lại xác nhận nữa. KHÔNG bắn Telegram — chính người đang
 * thao tác đây đã biết về lượt đặt này rồi.
 */
export async function createStaffReservation(input: ReservationFormValues): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AppError("Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.");
  }

  const { error } = await supabase.from("reservations").insert({
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    party_size: input.partySize,
    reservation_time: new Date(input.reservationTime).toISOString(),
    note: input.note || null,
    status: "confirmed",
    created_by: user.id,
  });

  if (error) {
    throw new AppError("Không thể tạo đặt bàn. Vui lòng thử lại.", error);
  }
}

/**
 * Danh sách lượt đặt CHƯA kết thúc ('pending' + 'confirmed'), sắp theo giờ
 * hẹn gần nhất trước — dùng cho `/staff/reservations` (toàn bộ danh sách) VÀ
 * `useTables` (lọc lại còn đúng những lượt 'confirmed' đã gán bàn để hiển thị
 * badge, xem hooks/useTables.ts).
 */
export async function getActiveReservations(): Promise<ReservationWithTable[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, table:tables(table_number)")
    .in("status", ["pending", "confirmed"])
    .order("reservation_time", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách đặt bàn.", error);
  }

  // Xem ghi chú ở order.service.ts/staffCall.service.ts: Database type viết
  // tay không có metadata Relationships nên ép kiểu tường minh 1 lần cho
  // trường embed (table).
  type RawRow = ReservationsRow & { table: { table_number: number } | null };
  const rows = (data ?? []) as unknown as RawRow[];

  return rows.map(({ table, ...rest }) => ({ ...rest, table_number: table?.table_number ?? null }));
}

/** Nhân viên gọi lại xác nhận 1 lượt khách tự đặt qua `/dat-ban`. */
export async function confirmReservation(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "confirmed" })
    .eq("id", reservationId);

  if (error) {
    throw new AppError("Không thể xác nhận đặt bàn.", error);
  }
}

/** Từ chối (đang 'pending') hoặc huỷ (đang 'confirmed') — cùng 1 hành động, `reason` tuỳ chọn để ghi lại lý do. */
export async function cancelReservation(reservationId: string, reason: string | null): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", cancel_reason: reason })
    .eq("id", reservationId);

  if (error) {
    throw new AppError("Không thể huỷ đặt bàn.", error);
  }
}

/** Quá giờ hẹn mà khách không tới — nhân viên tự đánh dấu (KHÔNG có cron tự động, xem giới hạn đã biết ở tài liệu dự án). */
export async function markReservationNoShow(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "no_show" })
    .eq("id", reservationId);

  if (error) {
    throw new AppError("Không thể cập nhật đặt bàn.", error);
  }
}

/** Khách đã tới — đóng hồ sơ đặt bàn. Bàn tự chuyển 'occupied' đúng lúc khách gửi đơn đầu tiên (không đụng ở đây). */
export async function markReservationSeated(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "seated" })
    .eq("id", reservationId);

  if (error) {
    throw new AppError("Không thể cập nhật đặt bàn.", error);
  }
}

/** Gán/gỡ bàn cho 1 lượt đặt đã xác nhận — truyền `null` để gỡ ("Chưa gán bàn"). */
export async function assignReservationTable(reservationId: string, tableId: string | null): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ table_id: tableId })
    .eq("id", reservationId);

  if (error) {
    throw new AppError("Không thể gán bàn cho lượt đặt này.", error);
  }
}

/** Làm mới danh sách khi có thêm/sửa lượt đặt bàn bất kỳ. */
export function subscribeToReservationChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:reservations")
    .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => onChange())
    .subscribe();
}
