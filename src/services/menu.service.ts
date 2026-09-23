import { supabase } from "@/lib/supabase/client";
import type { CategoryFormInput, CategoryWithItems, MenuItemFormInput, MenuItemWithOptions } from "@/types";
import { AppError } from "@/types";
import type { CategoriesRow, ItemOptionsRow, MenuItemsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Tải toàn bộ danh mục + món (kèm option) đang active, gộp sẵn thành cây
 * category -> items để component chỉ việc render, không phải tự nhóm dữ liệu.
 * Món hết hàng (is_available = false) vẫn được trả về (để hiển thị mờ + badge
 * "Hết món") thay vì ẩn hẳn, giúp khách không thắc mắc vì sao menu "thiếu món".
 * Cũng được tái sử dụng cho bảng "Hết món nhanh" của nhân viên (Module 2).
 */
export async function getMenu(): Promise<CategoryWithItems[]> {
  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }, { data: options, error: optionsError }] =
    await Promise.all([
      supabase.from("categories").select("*").order("display_order", { ascending: true }),
      supabase.from("menu_items").select("*").order("name", { ascending: true }),
      supabase.from("item_options").select("*"),
    ]);

  if (categoriesError || itemsError || optionsError) {
    throw new AppError(
      "Không thể tải thực đơn. Vui lòng kiểm tra kết nối mạng và thử lại.",
      categoriesError ?? itemsError ?? optionsError
    );
  }

  const optionsByMenuItem = new Map<string, MenuItemWithOptions["options"]>();
  for (const option of options ?? []) {
    const list = optionsByMenuItem.get(option.menu_item_id) ?? [];
    list.push(option);
    optionsByMenuItem.set(option.menu_item_id, list);
  }

  const itemsByCategory = new Map<string, MenuItemWithOptions[]>();
  for (const item of items ?? []) {
    const withOptions: MenuItemWithOptions = {
      ...item,
      options: optionsByMenuItem.get(item.id) ?? [],
    };
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(withOptions);
    itemsByCategory.set(item.category_id, list);
  }

  return (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    display_order: category.display_order,
    items: itemsByCategory.get(category.id) ?? [],
  }));
}

/**
 * Bật/tắt nhanh trạng thái còn món (is_available) — dùng cho bảng điều khiển
 * "Hết món nhanh" của nhân viên/bếp. Khách hàng đang xem menu sẽ thấy thay
 * đổi ngay lập tức qua subscribeToMenuItemChanges bên dưới.
 */
export async function setMenuItemAvailability(
  menuItemId: string,
  isAvailable: boolean
): Promise<void> {
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", menuItemId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái món. Vui lòng thử lại.", error);
  }
}

/**
 * Lắng nghe realtime thay đổi is_available/price trên menu_items để khách
 * đang xem menu thấy ngay khi bếp bấm "Hết món" — không cần tải lại trang.
 */
export function subscribeToMenuItemChanges(
  onChange: (item: MenuItemsRow) => void
): RealtimeChannel {
  return supabase
    .channel("public:menu_items")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "menu_items" },
      (payload) => onChange(payload.new as MenuItemsRow)
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Module 3 — Quản lý menu (CRUD) cho chủ quán. Các trang khách hàng/nhân viên
// chỉ ĐỌC qua getMenu()/subscribeToMenuItemChanges() ở trên; mọi thay đổi cấu
// trúc (thêm/sửa/xoá danh mục, món, option) đi qua các hàm dưới đây.
// ---------------------------------------------------------------------------

export async function createCategory(input: CategoryFormInput): Promise<CategoriesRow> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, display_order: input.displayOrder })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo danh mục mới.", error);
  }
  return data;
}

export async function updateCategory(categoryId: string, input: CategoryFormInput): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({ name: input.name, display_order: input.displayOrder })
    .eq("id", categoryId);

  if (error) {
    throw new AppError("Không thể cập nhật danh mục.", error);
  }
}

/** Xoá danh mục sẽ xoá theo (CASCADE) toàn bộ món + option thuộc danh mục đó — luôn hỏi xác nhận ở UI trước khi gọi hàm này. */
export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    throw new AppError("Không thể xoá danh mục. Vui lòng thử lại.", error);
  }
}

export async function createMenuItem(input: MenuItemFormInput): Promise<MenuItemsRow> {
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      category_id: input.categoryId,
      name: input.name,
      price: input.price,
      image_url: input.imageUrl,
      station_type: input.stationType,
      is_available: input.isAvailable,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo món mới.", error);
  }
  return data;
}

export async function updateMenuItem(menuItemId: string, input: MenuItemFormInput): Promise<void> {
  const { error } = await supabase
    .from("menu_items")
    .update({
      category_id: input.categoryId,
      name: input.name,
      price: input.price,
      image_url: input.imageUrl,
      station_type: input.stationType,
      is_available: input.isAvailable,
    })
    .eq("id", menuItemId);

  if (error) {
    throw new AppError("Không thể cập nhật món.", error);
  }
}

/**
 * Xoá món sẽ xoá theo (CASCADE) toàn bộ option của món đó. order_items cũ
 * tham chiếu món này vẫn được giữ nguyên (không cascade) để không làm mất
 * lịch sử đơn hàng — nếu món đã từng được đặt, thao tác xoá sẽ LỖI (Postgres
 * chặn theo khoá ngoại). Từ Module 11, xoá cũng LỖI nếu món đang là 1 thành
 * phần của combo nào đó (combo_items.menu_item_id on delete restrict, xem
 * schema.sql) — cần gỡ món khỏi combo trước.
 */
export async function deleteMenuItem(menuItemId: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", menuItemId);

  if (error) {
    throw new AppError(
      "Không thể xoá món. Nếu món đã từng được đặt, hãy tắt \"còn hàng\" thay vì xoá; nếu món đang thuộc 1 combo, hãy gỡ khỏi combo trước.",
      error
    );
  }
}

export async function createItemOption(
  menuItemId: string,
  optionName: string,
  additionalPrice: number
): Promise<ItemOptionsRow> {
  const { data, error } = await supabase
    .from("item_options")
    .insert({ menu_item_id: menuItemId, option_name: optionName, additional_price: additionalPrice })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể thêm topping/option.", error);
  }
  return data;
}

export async function updateItemOption(
  optionId: string,
  optionName: string,
  additionalPrice: number
): Promise<void> {
  const { error } = await supabase
    .from("item_options")
    .update({ option_name: optionName, additional_price: additionalPrice })
    .eq("id", optionId);

  if (error) {
    throw new AppError("Không thể cập nhật topping/option.", error);
  }
}

export async function deleteItemOption(optionId: string): Promise<void> {
  const { error } = await supabase.from("item_options").delete().eq("id", optionId);

  if (error) {
    throw new AppError("Không thể xoá topping/option.", error);
  }
}
