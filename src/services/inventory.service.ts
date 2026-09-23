import { supabase } from "@/lib/supabase/client";
import {
  AppError,
  type IngredientFormInput,
  type InventoryDeductionResult,
  type RecipeItemWithIngredient,
  type StockAdjustmentInput,
} from "@/types";
import type { IngredientsRow, RecipeItemsRow, ShopSettingsRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export async function getAllIngredients(): Promise<IngredientsRow[]> {
  const { data, error } = await supabase.from("ingredients").select("*").order("name", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách nguyên liệu.", error);
  }
  return data ?? [];
}

/**
 * Nguyên liệu sắp/đã hết (stock_quantity < min_threshold) — lọc ở tầng
 * client vì số lượng nguyên liệu của 1 quán rất nhỏ (không cần view/RPC
 * riêng ở Postgres để so sánh 2 cột), khớp quy ước đã dùng cho
 * revenue/best-seller ở analytics.service.ts.
 */
export async function getLowStockIngredients(): Promise<IngredientsRow[]> {
  const all = await getAllIngredients();
  return all.filter((ingredient) => ingredient.stock_quantity < ingredient.min_threshold);
}

export async function createIngredient(input: IngredientFormInput): Promise<IngredientsRow> {
  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name: input.name, unit: input.unit, min_threshold: input.minThreshold })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo nguyên liệu mới. Tên nguyên liệu có thể đã tồn tại.", error);
  }
  return data;
}

export async function updateIngredientDetails(
  ingredientId: string,
  input: IngredientFormInput
): Promise<void> {
  const { error } = await supabase
    .from("ingredients")
    .update({ name: input.name, unit: input.unit, min_threshold: input.minThreshold })
    .eq("id", ingredientId);

  if (error) {
    throw new AppError("Không thể cập nhật nguyên liệu.", error);
  }
}

/** Xoá nguyên liệu — CASCADE xoá luôn các dòng công thức có dùng nguyên liệu này. */
export async function deleteIngredient(ingredientId: string): Promise<void> {
  const { error } = await supabase.from("ingredients").delete().eq("id", ingredientId);

  if (error) {
    throw new AppError("Không thể xoá nguyên liệu.", error);
  }
}

/** Nhập thêm hàng — cộng kho NGUYÊN TỬ qua RPC, tránh đọc-sửa-ghi nếu 2 nhân viên cùng nhập 1 nguyên liệu gần như đồng thời. */
export async function restockIngredient(input: StockAdjustmentInput): Promise<void> {
  if (input.quantityToAdd <= 0) {
    throw new AppError("Số lượng nhập kho phải lớn hơn 0.");
  }

  const { error } = await supabase.rpc("adjust_ingredient_stock", {
    p_ingredient_id: input.ingredientId,
    p_delta: input.quantityToAdd,
  });

  if (error) {
    throw new AppError("Không thể nhập kho. Vui lòng thử lại.", error);
  }
}

/** Công thức hiện tại của 1 món, kèm tên/đơn vị nguyên liệu để hiển thị trực tiếp (không cần join thêm ở component). */
export async function getRecipeForMenuItem(menuItemId: string): Promise<RecipeItemWithIngredient[]> {
  const { data, error } = await supabase
    .from("recipe_items")
    .select("*, ingredient:ingredients(name, unit)")
    .eq("menu_item_id", menuItemId);

  if (error) {
    throw new AppError("Không thể tải công thức của món.", error);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed.
  type RawRow = RecipeItemsRow & { ingredient: { name: string; unit: string } | null };
  return ((data ?? []) as unknown as RawRow[]).map(({ ingredient, ...rest }) => ({
    ...rest,
    ingredientName: ingredient?.name ?? "Nguyên liệu đã xoá",
    ingredientUnit: ingredient?.unit ?? "",
  }));
}

export async function addRecipeItem(
  menuItemId: string,
  ingredientId: string,
  quantityRequired: number
): Promise<void> {
  const { error } = await supabase
    .from("recipe_items")
    .insert({ menu_item_id: menuItemId, ingredient_id: ingredientId, quantity_required: quantityRequired });

  if (error) {
    throw new AppError(
      "Không thể thêm nguyên liệu vào công thức. Nguyên liệu này có thể đã có trong công thức của món.",
      error
    );
  }
}

export async function updateRecipeItemQuantity(
  recipeItemId: string,
  quantityRequired: number
): Promise<void> {
  const { error } = await supabase
    .from("recipe_items")
    .update({ quantity_required: quantityRequired })
    .eq("id", recipeItemId);

  if (error) {
    throw new AppError("Không thể cập nhật công thức.", error);
  }
}

export async function removeRecipeItem(recipeItemId: string): Promise<void> {
  const { error } = await supabase.from("recipe_items").delete().eq("id", recipeItemId);

  if (error) {
    throw new AppError("Không thể xoá nguyên liệu khỏi công thức.", error);
  }
}

export async function getShopSettings(): Promise<ShopSettingsRow> {
  const { data, error } = await supabase.from("shop_settings").select("*").eq("id", true).maybeSingle();

  if (error) {
    throw new AppError("Không thể tải cấu hình quán.", error);
  }

  // Dòng singleton luôn được seed sẵn trong schema.sql — nếu vì lý do gì đó
  // chưa có (ví dụ quên chạy schema.sql sau khi kéo code mới), trả về mặc
  // định an toàn (không chặn đơn) thay vì throw, để không làm sập toàn bộ KDS.
  return data ?? { id: true, block_order_when_insufficient_stock: false, updated_at: new Date().toISOString() };
}

export async function setBlockWhenInsufficientStock(value: boolean): Promise<void> {
  const { error } = await supabase
    .from("shop_settings")
    .update({ block_order_when_insufficient_stock: value })
    .eq("id", true);

  if (error) {
    throw new AppError("Không thể cập nhật cấu hình.", error);
  }
}

/**
 * Kiểm tra + trừ kho khi 1 order_item chuyển sang 'preparing' (gọi từ
 * order.service.updateOrderItemStatus). Nếu quán bật "chặn khi thiếu kho" và
 * có nguyên liệu không đủ, NÉM LỖI (không trừ kho, không cho đổi trạng thái).
 * Ngược lại LUÔN trừ kho — kể cả khi thiếu, cho phép âm (xem schema.sql) —
 * và trả về danh sách tên nguyên liệu thiếu để UI hiển thị cảnh báo.
 *
 * Có race nhỏ giữa bước kiểm tra (đọc trước) và bước trừ (RPC riêng): chấp
 * nhận được ở quy mô 1 quán 15 bàn. Bản thân việc trừ kho luôn ĐÚNG vì chạy
 * atomic trong 1 câu UPDATE (xem deduct_inventory_for_order_item) — chỉ có
 * THÔNG BÁO cảnh báo có thể lệch nếu 2 đơn cùng món được bấm "Bắt đầu làm"
 * trong cùng khoảnh khắc.
 */
export async function checkAndDeductInventoryForOrderItem(
  menuItemId: string,
  quantityOrdered: number
): Promise<InventoryDeductionResult> {
  const [{ data: settings }, { data: recipeRows, error: recipeError }] = await Promise.all([
    supabase.from("shop_settings").select("block_order_when_insufficient_stock").eq("id", true).maybeSingle(),
    supabase
      .from("recipe_items")
      .select("quantity_required, ingredient:ingredients(name, stock_quantity)")
      .eq("menu_item_id", menuItemId),
  ]);

  if (recipeError) {
    throw new AppError("Không thể kiểm tra công thức để trừ kho.", recipeError);
  }

  type RawRow = {
    quantity_required: number;
    ingredient: { name: string; stock_quantity: number } | null;
  };
  const rows = (recipeRows ?? []) as unknown as RawRow[];

  // Món chưa cấu hình công thức (ví dụ nước suối đóng chai) — không có gì để trừ.
  if (rows.length === 0) {
    return { insufficientIngredients: [] };
  }

  const insufficientIngredients = rows
    .filter(
      (row): row is RawRow & { ingredient: { name: string; stock_quantity: number } } =>
        row.ingredient !== null && row.ingredient.stock_quantity < row.quantity_required * quantityOrdered
    )
    .map((row) => row.ingredient.name);

  if (insufficientIngredients.length > 0 && settings?.block_order_when_insufficient_stock) {
    throw new AppError(
      `Không đủ nguyên liệu: ${insufficientIngredients.join(", ")}. Quán đã bật chặn khi thiếu kho — vào Quản lý kho để nhập thêm.`
    );
  }

  const { error: deductError } = await supabase.rpc("deduct_inventory_for_order_item", {
    p_menu_item_id: menuItemId,
    p_quantity_ordered: quantityOrdered,
  });

  if (deductError) {
    throw new AppError("Không thể trừ kho nguyên liệu.", deductError);
  }

  return { insufficientIngredients };
}

/** Realtime tồn kho — dùng cho badge cảnh báo trên Dashboard + trang Quản lý kho tự cập nhật khi KDS trừ kho. */
export function subscribeToIngredientChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:ingredients")
    .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, () => onChange())
    .subscribe();
}
