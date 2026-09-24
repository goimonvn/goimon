import { supabase } from "@/lib/supabase/client";
import { AppError, type StaffCallWithTable } from "@/types";
import type { StaffCallRequestType, StaffCallsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { updateTableStatus } from "./table.service";
import { notifyStaffCallTelegram } from "./telegram.service";

/**
 * Ghi nhận yêu cầu của khách (gọi nhân viên / xin đá / yêu cầu thanh toán).
 * Đẩy realtime tới màn hình nhân viên + báo quán qua Telegram (Module 7).
 *
 * `tableNumber` do CALLER truyền vào (màn hình khách đã sẵn có từ
 * `useTable()`) thay vì tự query lại: khách (anon) chỉ có policy RLS INSERT
 * trên `staff_calls`, KHÔNG có SELECT, nên `.insert().select()` sẽ luôn trả
 * về 0 dòng (RLS lọc RETURNING) — nhận sẵn tableNumber vừa tránh lỗi đó vừa
 * đỡ 1 round-trip.
 */
export async function createStaffCall(
  tableId: string,
  requestType: StaffCallRequestType,
  tableNumber: number
): Promise<void> {
  const { error } = await supabase.from("staff_calls").insert({
    table_id: tableId,
    request_type: requestType,
  });

  if (error) {
    throw new AppError("Không thể gửi yêu cầu tới nhân viên. Vui lòng thử lại.", error);
  }

  // Module 13: khách bấm "Yêu cầu thanh toán" -> bàn chuyển sang trạng thái
  // "Chờ thanh toán" (payment_pending) để nhân viên thấy ngay trên sơ đồ bàn
  // mà không cần mở chi tiết bàn ra xem. Best-effort — không chặn việc gửi
  // yêu cầu nếu bước đổi trạng thái bàn lỗi (cùng tinh thần với updateTableStatus
  // ở order.service.ts#createOrder).
  if (requestType === "checkout") {
    try {
      await updateTableStatus(tableId, "payment_pending");
    } catch {
      // Bỏ qua: trạng thái bàn không ảnh hưởng tới việc yêu cầu đã được ghi nhận thành công.
    }
  }

  notifyStaffCallTelegram(tableNumber, requestType);
}

/** Lấy các yêu cầu hỗ trợ đang chờ xử lý, kèm số bàn, mới nhất lên trước để nhân viên ưu tiên xử lý bàn chờ lâu. */
export async function getPendingStaffCalls(): Promise<StaffCallWithTable[]> {
  const { data, error } = await supabase
    .from("staff_calls")
    .select("*, table:tables(table_number)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách yêu cầu hỗ trợ.", error);
  }

  // Xem ghi chú ở order.service.ts: Database type viết tay không có metadata
  // Relationships nên ép kiểu tường minh một lần cho trường embed (table).
  type RawRow = StaffCallsRow & { table: { table_number: number } | null };
  const rows = (data ?? []) as unknown as RawRow[];

  return rows.map(({ table, ...rest }) => ({ ...rest, table_number: table?.table_number ?? null }));
}

export async function resolveStaffCall(callId: string): Promise<void> {
  const { error } = await supabase
    .from("staff_calls")
    .update({ status: "resolved" })
    .eq("id", callId);

  if (error) {
    throw new AppError("Không thể cập nhật yêu cầu hỗ trợ.", error);
  }
}

/** Làm mới danh sách khi có bất kỳ thay đổi nào (tạo mới / được xử lý) trên staff_calls. */
export function subscribeToStaffCalls(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:staff_calls:list")
    .on("postgres_changes", { event: "*", schema: "public", table: "staff_calls" }, () =>
      onChange()
    )
    .subscribe();
}

/** Riêng cho hệ thống cảnh báo (chuông/rung) — chỉ bắn khi có yêu cầu MỚI, tránh rung lại khi nhân viên tự cập nhật trạng thái. */
export function subscribeToNewStaffCalls(
  onInsert: (call: StaffCallWithTable) => void
): RealtimeChannel {
  return supabase
    .channel("public:staff_calls:alert")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "staff_calls" },
      (payload) => {
        const row = payload.new as StaffCallsRow;
        // Payload realtime của Postgres Changes không kèm bảng join (table_number);
        // hệ thống cảnh báo chỉ cần request_type để phát chuông + nội dung toast.
        onInsert({ ...row, table_number: null });
      }
    )
    .subscribe();
}
