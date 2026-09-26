"use client";

import { AdminMenuItemRow } from "@/components/admin/AdminMenuItemRow";
import { CategoryFormDialog } from "@/components/admin/CategoryFormDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MenuItemFormSheet } from "@/components/admin/MenuItemFormSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu } from "@/hooks/useMenu";
import { usePageTitle } from "@/hooks/usePageTitle";
import { deleteCategory, deleteMenuItem } from "@/services/menu.service";
import type { MenuItemWithOptions } from "@/types";
import type { CategoriesRow } from "@/types/database.types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CategorySummary = Pick<CategoriesRow, "id" | "name" | "display_order">;
type CategoryDialogState = { mode: "create" } | { mode: "edit"; category: CategorySummary } | null;
type ItemSheetState = { categoryId: string; itemId: string | null } | null;
type DeleteTarget =
  | { type: "category"; id: string; label: string }
  | { type: "item"; id: string; label: string };

/**
 * Trang quản lý menu của chủ quán: CRUD đầy đủ danh mục + món + option.
 * Dùng lại nguyên useMenu() của Module 1 (đã có realtime is_available) —
 * gọi refetch() sau mỗi thao tác ghi để đồng bộ lại toàn bộ cây danh mục.
 */
export default function AdminMenuPage() {
  usePageTitle("Quản lý menu");
  const { categories, loading, refetch } = useMenu();
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>(null);
  const [itemSheet, setItemSheet] = useState<ItemSheetState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  function findItem(itemId: string | null): MenuItemWithOptions | null {
    if (!itemId) return null;
    for (const category of categories) {
      const found = category.items.find((i) => i.id === itemId);
      if (found) return found;
    }
    return null;
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "category") {
        await deleteCategory(deleteTarget.id);
        toast.success("Đã xoá danh mục.");
      } else {
        await deleteMenuItem(deleteTarget.id);
        toast.success("Đã xoá món.");
      }
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Quản lý menu</h1>
          <p className="text-sm text-muted-foreground">Thêm/sửa/xoá danh mục, món và topping hiển thị cho khách.</p>
        </div>
        <Button onClick={() => setCategoryDialog({ mode: "create" })}>
          <Plus className="h-4 w-4" />
          Thêm danh mục
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Chưa có danh mục nào. Bấm &quot;Thêm danh mục&quot; để bắt đầu.
        </p>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{category.name}</h2>
                  <p className="text-xs text-muted-foreground">Thứ tự hiển thị: {category.display_order}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCategoryDialog({
                        mode: "edit",
                        category: {
                          id: category.id,
                          name: category.name,
                          display_order: category.display_order,
                        },
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDeleteTarget({ type: "category", id: category.id, label: category.name })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemSheet({ categoryId: category.id, itemId: null })}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm món
                  </Button>
                </div>
              </div>

              {category.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Danh mục chưa có món nào.</p>
              ) : (
                <div className="space-y-2">
                  {category.items.map((item) => (
                    <AdminMenuItemRow
                      key={item.id}
                      item={item}
                      onEdit={() => setItemSheet({ categoryId: category.id, itemId: item.id })}
                      onDelete={() => setDeleteTarget({ type: "item", id: item.id, label: item.name })}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        open={categoryDialog !== null}
        category={categoryDialog?.mode === "edit" ? categoryDialog.category : null}
        onOpenChange={(open) => !open && setCategoryDialog(null)}
        onSaved={refetch}
      />

      <MenuItemFormSheet
        open={itemSheet !== null}
        item={findItem(itemSheet?.itemId ?? null)}
        categories={categoryOptions}
        defaultCategoryId={itemSheet?.categoryId ?? categoryOptions[0]?.id ?? ""}
        onOpenChange={(open) => !open && setItemSheet(null)}
        onCreated={(newItemId) =>
          setItemSheet((prev) => (prev ? { categoryId: prev.categoryId, itemId: newItemId } : prev))
        }
        onSaved={refetch}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.type === "category" ? "Xoá danh mục?" : "Xoá món?"}
        description={
          deleteTarget?.type === "category"
            ? `Danh mục "${deleteTarget.label}" và TOÀN BỘ món/option bên trong sẽ bị xoá vĩnh viễn.`
            : `Món "${deleteTarget?.label ?? ""}" sẽ bị xoá. Nếu món đã từng được đặt, hãy cân nhắc tắt "còn hàng" thay vì xoá.`
        }
        submitting={deleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
