import { supabase } from "@/lib/supabase/client";
import {
  AppError,
  type MenuItemMargin,
  type PurchaseReceiptFormInput,
  type PurchaseReceiptItemWithIngredient,
  type PurchaseReceiptWithSupplier,
  type SupplierFormInput,
} from "@/types";
import type { PurchaseReceiptsRow, SuppliersRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Nhà cung cấp — CRUD đầy đủ (khác phiếu nhập hàng bên dưới, xem ghi chú ở
// deleteSupplier và recordPurchaseReceipt).
// ---------------------------------------------------------------------------

export async function getSuppliers(): Promise<SuppliersRow[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải danh sách nhà cung cấp.", error);
  }
  return data ?? [];
}

export async function createSupplier(input: SupplierFormInput): Promise<SuppliersRow> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      note: input.note.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo nhà cung cấp mới.", error);
  }
  return data;
}

export async function updateSupplier(supplierId: string, input: SupplierFormInput): Promise<void> {
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input.name,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      note: input.note.trim() || null,
    })
    .eq("id", supplierId);

  if (error) {
    throw new AppError("Không thể cập nhật nhà cung cấp.", error);
  }
}

/**
 * Xoá nhà cung cấp — LỖI nếu nhà cung cấp này đã có phiếu nhập hàng
 * (purchase_receipts.supplier_id on delete restrict, xem schema.sql Module
 * 20) — CỐ Ý không cho xoá âm thầm, vì sẽ làm mất dấu vết "hàng này nhập từ
 * ai" của các phiếu đã ghi. Khớp quy ước thông báo lỗi chung của
 * menu.service.ts#deleteMenuItem (không phân biệt mã lỗi Postgres, chỉ đưa
 * ra 1 thông báo dễ hiểu bao quát nguyên nhân thường gặp nhất).
 */
export async function deleteSupplier(supplierId: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);

  if (error) {
    throw new AppError(
      "Không thể xoá nhà cung cấp. Nếu nhà cung cấp này đã có phiếu nhập hàng, không thể xoá — đây là sổ sách tài chính.",
      error
    );
  }
}

export function subscribeToSupplierChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:suppliers")
    .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, () => onChange())
    .subscribe();
}

// ---------------------------------------------------------------------------
// Phiếu nhập hàng — SỔ SÁCH BẤT BIẾN: CHỈ tạo (qua RPC) + đọc lại, KHÔNG có
// updatePurchaseReceipt/deletePurchaseReceipt (xem ghi chú đầu Module 20 ở
// schema.sql — nhập nhầm thì ghi thêm 1 phiếu điều chỉnh mới).
// ---------------------------------------------------------------------------

/**
 * Toàn bộ phiếu nhập hàng, mới nhất trước, kèm SẴN tên nhà cung cấp + toàn bộ
 * dòng nguyên liệu của từng phiếu (2 round-trip: đọc phiếu, rồi đọc tất cả
 * dòng theo danh sách phiếu — khớp quy ước attachItemsToCombos ở
 * combo.service.ts, không lazy-load riêng lúc mở rộng chi tiết 1 phiếu vì số
 * phiếu của 1 quán nhỏ không đáng tối ưu N+1).
 */
export async function getPurchaseReceipts(): Promise<PurchaseReceiptWithSupplier[]> {
  const { data: receipts, error: receiptsError } = await supabase
    .from("purchase_receipts")
    .select("*, supplier:suppliers(name)")
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (receiptsError) {
    throw new AppError("Không thể tải danh sách phiếu nhập hàng.", receiptsError);
  }
  if (!receipts || receipts.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("purchase_receipt_items")
    .select("id, receipt_id, quantity, unit_cost, line_total, ingredient:ingredients(name, unit)")
    .in(
      "receipt_id",
      receipts.map((receipt) => receipt.id)
    );

  if (itemsError) {
    throw new AppError("Không thể tải chi tiết phiếu nhập hàng.", itemsError);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed.
  type RawReceiptRow = PurchaseReceiptsRow & { supplier: { name: string } | null };
  type RawItemRow = {
    id: string;
    receipt_id: string;
    quantity: number;
    unit_cost: number;
    line_total: number;
    ingredient: { name: string; unit: string } | null;
  };

  const itemsByReceipt = new Map<string, PurchaseReceiptItemWithIngredient[]>();
  for (const row of (items ?? []) as unknown as RawItemRow[]) {
    const list = itemsByReceipt.get(row.receipt_id) ?? [];
    list.push({
      id: row.id,
      // Không thể xảy ra thật sự (ingredient_id on delete restrict) — giữ
      // fallback phòng hờ, khớp quy ước RecipeItemWithIngredient.
      ingredientName: row.ingredient?.name ?? "Nguyên liệu đã xoá",
      ingredientUnit: row.ingredient?.unit ?? "",
      quantity: row.quantity,
      unitCost: row.unit_cost,
      lineTotal: row.line_total,
    });
    itemsByReceipt.set(row.receipt_id, list);
  }

  return ((receipts ?? []) as unknown as RawReceiptRow[]).map(({ supplier, ...rest }) => ({
    ...rest,
    supplierName: supplier?.name ?? "Không rõ",
    items: itemsByReceipt.get(rest.id) ?? [],
  }));
}

/**
 * Ghi 1 phiếu nhập hàng — gọi RPC `record_purchase_receipt` (atomic: tạo
 * phiếu + N dòng + cộng kho + cập nhật giá vốn bình quân từng nguyên liệu
 * trong 1 transaction, xem schema.sql Module 20). Trả về id phiếu vừa tạo.
 */
export async function recordPurchaseReceipt(input: PurchaseReceiptFormInput): Promise<string> {
  if (input.items.length === 0) {
    throw new AppError("Phiếu nhập hàng phải có ít nhất 1 dòng nguyên liệu.");
  }

  const { data, error } = await supabase.rpc("record_purchase_receipt", {
    p_supplier_id: input.supplierId,
    p_receipt_date: input.receiptDate,
    p_note: input.note.trim() || null,
    p_items: input.items.map((item) => ({
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
    })),
  });

  if (error || !data) {
    throw new AppError("Không thể lưu phiếu nhập hàng.", error);
  }
  return data;
}

export function subscribeToPurchaseReceiptChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:purchase_receipts")
    .on("postgres_changes", { event: "*", schema: "public", table: "purchase_receipts" }, () => onChange())
    .subscribe();
}

// ---------------------------------------------------------------------------
// Giá vốn/biên lợi nhuận theo món — tính hoàn toàn ở CLIENT, xem ghi chú ở
// đầu Module 20 trong schema.sql và JSDoc của MenuItemMargin.
// ---------------------------------------------------------------------------

export async function getMenuItemMargins(): Promise<MenuItemMargin[]> {
  const [
    { data: categories, error: categoriesError },
    { data: menuItems, error: menuItemsError },
    { data: recipeRows, error: recipeError },
    { data: ingredients, error: ingredientsError },
  ] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("menu_items").select("id, category_id, name, price"),
    supabase.from("recipe_items").select("menu_item_id, ingredient_id, quantity_required"),
    supabase.from("ingredients").select("id, avg_cost"),
  ]);

  if (categoriesError || menuItemsError || recipeError || ingredientsError) {
    throw new AppError(
      "Không thể tính giá vốn/biên lợi nhuận theo món.",
      categoriesError ?? menuItemsError ?? recipeError ?? ingredientsError
    );
  }

  const categoryNameById = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const avgCostById = new Map((ingredients ?? []).map((ingredient) => [ingredient.id, ingredient.avg_cost]));

  const recipeLinesByMenuItem = new Map<string, { ingredientId: string; quantityRequired: number }[]>();
  for (const row of recipeRows ?? []) {
    const list = recipeLinesByMenuItem.get(row.menu_item_id) ?? [];
    list.push({ ingredientId: row.ingredient_id, quantityRequired: row.quantity_required });
    recipeLinesByMenuItem.set(row.menu_item_id, list);
  }

  return (menuItems ?? []).map((item): MenuItemMargin => {
    const categoryName = categoryNameById.get(item.category_id) ?? "—";
    const recipeLines = recipeLinesByMenuItem.get(item.id);

    // Món chưa cấu hình công thức (vd nước suối đóng chai) — không có gì để
    // cộng giá vốn, khác với "đã có công thức nhưng chưa từng nhập hàng"
    // (hasCostData = false bên dưới) — cả 2 đều hiển thị "chưa có dữ liệu"
    // ở UI nhưng lý do khác nhau nên giữ `cost = null` riêng cho trường hợp này.
    if (!recipeLines || recipeLines.length === 0) {
      return {
        menuItemId: item.id,
        menuItemName: item.name,
        categoryName,
        price: item.price,
        cost: null,
        margin: null,
        marginPercent: null,
        hasCostData: false,
      };
    }

    let cost = 0;
    let hasCostData = true;
    for (const line of recipeLines) {
      const avgCost = avgCostById.get(line.ingredientId);
      if (avgCost === undefined || avgCost === 0) hasCostData = false;
      cost += (avgCost ?? 0) * line.quantityRequired;
    }

    const margin = item.price - cost;
    const marginPercent = item.price > 0 ? Math.round((margin / item.price) * 100) : null;

    return {
      menuItemId: item.id,
      menuItemName: item.name,
      categoryName,
      price: item.price,
      cost,
      margin,
      marginPercent,
      hasCostData,
    };
  });
}
