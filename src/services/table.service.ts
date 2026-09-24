import { supabase } from "@/lib/supabase/client";
import { AppError } from "@/types";
import type { TableShape, TableStatus, TablesRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Tìm bàn theo số bàn (lấy từ query string `?table=`).
 * Trả về null nếu không tìm thấy (KHÔNG throw) để caller tự quyết định hiển thị.
 */
export async function getTableByNumber(
  tableNumber: number
): Promise<TablesRow | null> {
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể tải thông tin bàn. Vui lòng thử lại.", error);
  }

  return data;
}

/** Lấy 1 bàn theo id — dùng cho trang in hoá đơn (mở tab riêng, không có sẵn state từ trang danh sách). */
export async function getTableById(tableId: string): Promise<TablesRow | null> {
  const { data, error } = await supabase.from("tables").select("*").eq("id", tableId).maybeSingle();

  if (error) {
    throw new AppError("Không thể tải thông tin bàn.", error);
  }

  return data;
}

/** Lấy toàn bộ danh sách bàn (15 bàn), sắp theo số bàn — dùng cho lưới quản lý bàn của nhân viên. */
export async function getAllTables(): Promise<TablesRow[]> {
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .order("table_number", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách bàn.", error);
  }

  return data ?? [];
}

export async function updateTableStatus(
  tableId: string,
  status: TableStatus
): Promise<void> {
  const { error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", tableId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái bàn.", error);
  }
}

// ---------------------------------------------------------------------------
// Module 13 — Sơ đồ Bàn theo Khu vực. Gán khu vực/hình dạng dùng ở `/admin/zones`
// (phần "Gán khu vực & hình dạng cho từng bàn"); đổi trạng thái nhanh dùng ở
// `/staff/tables` (nhân viên bấm 1 chạm "Bàn dọn dẹp" -> "Bàn trống").
// ---------------------------------------------------------------------------

/** Gán/gỡ khu vực cho 1 bàn — truyền `null` để gỡ (bàn không thuộc khu vực nào). */
export async function assignTableZone(tableId: string, zoneId: string | null): Promise<void> {
  const { error } = await supabase.from("tables").update({ zone_id: zoneId }).eq("id", tableId);

  if (error) {
    throw new AppError("Không thể gán khu vực cho bàn.", error);
  }
}

/** Đổi hình dạng hiển thị của 1 bàn (vuông/tròn/chữ nhật) — chỉ ảnh hưởng UI sơ đồ bàn, không ảnh hưởng nghiệp vụ. */
export async function updateTableShape(tableId: string, shape: TableShape): Promise<void> {
  const { error } = await supabase.from("tables").update({ shape }).eq("id", tableId);

  if (error) {
    throw new AppError("Không thể cập nhật hình dạng bàn.", error);
  }
}

/** Lắng nghe realtime mọi thay đổi trên bảng tables — dùng để làm mới lưới bàn của nhân viên. */
export function subscribeToTableChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:tables")
    .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => onChange())
    .subscribe();
}
