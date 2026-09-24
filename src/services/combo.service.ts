import { supabase } from "@/lib/supabase/client";
import { AppError, type ComboFormInput, type ComboItemWithMenu, type ComboWithItems } from "@/types";
import type { CombosRow, MenuItemsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Liệt kê đầy đủ tường minh các cột của menu_items (thay vì `menu_item:menu_items(*)`)
// để khớp quy ước MENU_ITEM_EMBED đã dùng ở order.service.ts — kết quả trả về
// đủ dữ liệu để "nổ" combo thành CartLine hoàn chỉnh (cần cả station_type để
// gán đúng trạm KDS, is_available để cảnh báo nếu 1 thành phần đã hết món).
// PHẢI liệt kê ĐỦ mọi cột của `MenuItemsRow` (kể cả `auto_reset_daily`, Module
// 12) — `RawComboItemRow.menu_item` khai kiểu `MenuItemsRow` đầy đủ, thiếu cột
// nào ở đây sẽ khiến field đó luôn `undefined` lúc chạy dù kiểu TypeScript vẫn
// khẳng định là `boolean` (ép kiểu `as unknown as` bên dưới không tự phát hiện
// được sai lệch này).
const MENU_ITEM_FULL_EMBED =
  "id, category_id, name, price, image_url, is_available, station_type, auto_reset_daily, created_at" as const;

type RawComboItemRow = {
  id: string;
  combo_id: string;
  quantity: number;
  menu_item: MenuItemsRow | null;
};

/** Gộp danh sách combo + danh sách combo_items (đã tải riêng) thành ComboWithItems[] — dùng chung cho cả 2 hàm getActiveCombosWithItems/getAllCombosWithItems bên dưới. */
function attachItemsToCombos(combos: CombosRow[], rawItems: RawComboItemRow[]): ComboWithItems[] {
  const itemsByCombo = new Map<string, ComboItemWithMenu[]>();
  for (const row of rawItems) {
    if (!row.menu_item) continue; // Món đã bị xoá (không thể xảy ra do on delete restrict, phòng hờ dữ liệu cũ).
    const list = itemsByCombo.get(row.combo_id) ?? [];
    list.push({ id: row.id, menuItem: row.menu_item, quantity: row.quantity });
    itemsByCombo.set(row.combo_id, list);
  }
  return combos.map((combo) => ({ ...combo, items: itemsByCombo.get(combo.id) ?? [] }));
}

/**
 * Combo ĐANG hiển thị (is_active) kèm món thành phần — dùng cho mục "Combo
 * Tiết Kiệm" trên thực đơn của khách (Module 1). RLS chỉ cho đọc combo
 * active + combo_items của combo active, xem schema.sql.
 */
export async function getActiveCombosWithItems(): Promise<ComboWithItems[]> {
  const { data: combos, error: combosError } = await supabase
    .from("combos")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (combosError) {
    throw new AppError("Không thể tải danh sách combo.", combosError);
  }
  if (!combos || combos.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("combo_items")
    .select(`id, combo_id, quantity, menu_item:menu_items(${MENU_ITEM_FULL_EMBED})`)
    .in(
      "combo_id",
      combos.map((c) => c.id)
    );

  if (itemsError) {
    throw new AppError("Không thể tải danh sách món trong combo.", itemsError);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed.
  return attachItemsToCombos(combos, (items ?? []) as unknown as RawComboItemRow[]);
}

// ---------------------------------------------------------------------------
// Quản trị (Admin) — /admin/combos
// ---------------------------------------------------------------------------

/** Toàn bộ combo (kể cả đã tắt) kèm món thành phần — dùng cho /admin/combos, RLS chỉ cho phép admin đọc đầy đủ. */
export async function getAllCombosWithItems(): Promise<ComboWithItems[]> {
  const { data: combos, error: combosError } = await supabase
    .from("combos")
    .select("*")
    .order("display_order", { ascending: true });

  if (combosError) {
    throw new AppError("Không thể tải danh sách combo.", combosError);
  }
  if (!combos || combos.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("combo_items")
    .select(`id, combo_id, quantity, menu_item:menu_items(${MENU_ITEM_FULL_EMBED})`)
    .in(
      "combo_id",
      combos.map((c) => c.id)
    );

  if (itemsError) {
    throw new AppError("Không thể tải danh sách món trong combo.", itemsError);
  }

  return attachItemsToCombos(combos, (items ?? []) as unknown as RawComboItemRow[]);
}

/**
 * Tạo/sửa 1 combo VÀ thay thế TOÀN BỘ danh sách món thành phần trong 1 lượt
 * gọi (2 round-trip: upsert combo, rồi xoá hết combo_items cũ + insert lại
 * danh sách mới) — đơn giản hơn nhiều so với tự diff từng dòng thêm/sửa/xoá,
 * chấp nhận được vì combo thường chỉ có vài món và admin sửa không thường
 * xuyên (khác `RecipeEditor` vốn ghi trực tiếp từng dòng ngay khi soạn).
 * KHÔNG chạy trong 1 transaction thật (Supabase JS không hỗ trợ multi-bảng)
 * — nếu bước 2 lỗi giữa chừng sau khi bước 1 đã lưu, combo vẫn được lưu đúng
 * thông tin cơ bản nhưng danh sách món có thể chưa cập nhật hết; admin có thể
 * mở lại form và lưu lại lần nữa.
 */
export async function saveCombo(comboId: string | null, input: ComboFormInput): Promise<CombosRow> {
  const comboPayload = {
    name: input.name,
    description: input.description || null,
    price: input.price,
    image_url: input.imageUrl,
    is_active: input.isActive,
    display_order: input.displayOrder,
  };

  let combo: CombosRow;
  if (comboId) {
    const { data, error } = await supabase
      .from("combos")
      .update(comboPayload)
      .eq("id", comboId)
      .select("*")
      .single();
    if (error || !data) {
      throw new AppError("Không thể cập nhật combo.", error);
    }
    combo = data;
  } else {
    const { data, error } = await supabase.from("combos").insert(comboPayload).select("*").single();
    if (error || !data) {
      throw new AppError("Không thể tạo combo mới.", error);
    }
    combo = data;
  }

  const { error: deleteError } = await supabase.from("combo_items").delete().eq("combo_id", combo.id);
  if (deleteError) {
    throw new AppError("Đã lưu thông tin combo nhưng không thể cập nhật danh sách món. Vui lòng thử lưu lại.", deleteError);
  }

  if (input.items.length > 0) {
    const { error: insertError } = await supabase.from("combo_items").insert(
      input.items.map((item) => ({
        combo_id: combo.id,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
      }))
    );
    if (insertError) {
      throw new AppError("Đã lưu thông tin combo nhưng không thể lưu danh sách món. Vui lòng thử lưu lại.", insertError);
    }
  }

  return combo;
}

/** Bật/tắt nhanh hiển thị 1 combo từ bảng danh sách — khách thấy ngay lập tức qua subscribeToComboChanges (realtime). */
export async function setComboActive(comboId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("combos").update({ is_active: isActive }).eq("id", comboId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái combo.", error);
  }
}

/** Xoá combo sẽ xoá theo (CASCADE) toàn bộ combo_items của combo đó. order_items cũ đã bán vẫn giữ nguyên (combo_id chuyển null, combo_name vẫn còn) — xem ghi chú schema.sql. */
export async function deleteCombo(comboId: string): Promise<void> {
  const { error } = await supabase.from("combos").delete().eq("id", comboId);

  if (error) {
    throw new AppError("Không thể xoá combo. Vui lòng thử lại.", error);
  }
}

/** Lắng nghe realtime thay đổi combos/combo_items — dùng cho khách (mục "Combo Tiết Kiệm" tự cập nhật) và trang /admin/combos. */
export function subscribeToComboChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:combos")
    .on("postgres_changes", { event: "*", schema: "public", table: "combos" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "combo_items" }, () => onChange())
    .subscribe();
}
