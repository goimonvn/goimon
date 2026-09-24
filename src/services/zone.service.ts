import { supabase } from "@/lib/supabase/client";
import { AppError, type ZoneFormInput, type ZoneWithTables } from "@/types";
import type { TablesRow, ZonesRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Lấy toàn bộ danh sách khu vực, sắp theo display_order — dùng cho tab lọc `/staff/tables` và trang quản lý `/admin/zones`. */
export async function getZones(): Promise<ZonesRow[]> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách khu vực.", error);
  }

  return data ?? [];
}

/**
 * Lấy toàn bộ khu vực kèm danh sách bàn thuộc từng khu vực — dùng cho phần
 * xem nhanh ở `/admin/zones` (mỗi khu vực có bao nhiêu bàn, bàn nào). Bàn
 * chưa được gán khu vực (zone_id null) không xuất hiện trong kết quả này.
 */
export async function getZonesWithTables(): Promise<ZoneWithTables[]> {
  const [{ data: zones, error: zonesError }, { data: tables, error: tablesError }] = await Promise.all([
    supabase.from("zones").select("*").order("display_order", { ascending: true }),
    supabase.from("tables").select("*").order("table_number", { ascending: true }),
  ]);

  if (zonesError || tablesError) {
    throw new AppError("Không thể tải danh sách khu vực.", zonesError ?? tablesError);
  }

  const tablesByZone = new Map<string, TablesRow[]>();
  for (const table of tables ?? []) {
    if (!table.zone_id) continue;
    const list = tablesByZone.get(table.zone_id) ?? [];
    list.push(table);
    tablesByZone.set(table.zone_id, list);
  }

  return (zones ?? []).map((zone) => ({
    ...zone,
    tables: tablesByZone.get(zone.id) ?? [],
  }));
}

export async function createZone(input: ZoneFormInput): Promise<ZonesRow> {
  const { data, error } = await supabase
    .from("zones")
    .insert({ name: input.name, display_order: input.displayOrder })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo khu vực mới.", error);
  }
  return data;
}

export async function updateZone(zoneId: string, input: ZoneFormInput): Promise<void> {
  const { error } = await supabase
    .from("zones")
    .update({ name: input.name, display_order: input.displayOrder })
    .eq("id", zoneId);

  if (error) {
    throw new AppError("Không thể cập nhật khu vực.", error);
  }
}

/** Xoá khu vực: các bàn thuộc khu vực này tự động về zone_id = null (on delete set null, xem schema.sql) — KHÔNG xoá bàn. */
export async function deleteZone(zoneId: string): Promise<void> {
  const { error } = await supabase.from("zones").delete().eq("id", zoneId);

  if (error) {
    throw new AppError("Không thể xoá khu vực. Vui lòng thử lại.", error);
  }
}

/** Làm mới danh sách khi có thay đổi (thêm/sửa/xoá) trên zones — dùng cho `/admin/zones` và tab khu vực ở `/staff/tables`. */
export function subscribeToZoneChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:zones")
    .on("postgres_changes", { event: "*", schema: "public", table: "zones" }, () => onChange())
    .subscribe();
}
