import { supabase } from "@/lib/supabase/client";
import { AppError } from "@/types";
import type { TableStatus, TablesRow } from "@/types/database.types";
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

/** Lắng nghe realtime mọi thay đổi trên bảng tables — dùng để làm mới lưới bàn của nhân viên. */
export function subscribeToTableChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:tables")
    .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => onChange())
    .subscribe();
}
