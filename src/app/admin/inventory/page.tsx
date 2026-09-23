"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { IngredientFormDialog } from "@/components/admin/IngredientFormDialog";
import { IngredientTable } from "@/components/admin/IngredientTable";
import { RecipeEditor } from "@/components/admin/RecipeEditor";
import { RestockDialog } from "@/components/admin/RestockDialog";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useIngredients } from "@/hooks/useIngredients";
import { useShopSettings } from "@/hooks/useShopSettings";
import { deleteIngredient } from "@/services/inventory.service";
import type { IngredientsRow } from "@/types/database.types";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Quản lý kho theo công thức (Module 6): danh sách nguyên liệu + tồn kho,
 * nhập thêm hàng, cấu hình chặn/cho phép khi thiếu nguyên liệu, và công thức
 * (định lượng nguyên liệu) của từng món — hệ thống tự trừ kho khi bếp bắt
 * đầu làm món (xem KDS + inventory.service.checkAndDeductInventoryForOrderItem).
 */
export default function AdminInventoryPage() {
  const { ingredients, loading, refetch } = useIngredients();
  const { settings, loading: settingsLoading, updating, toggleBlockWhenInsufficientStock } = useShopSettings();

  const [formOpen, setFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientsRow | null>(null);
  const [restockingIngredient, setRestockingIngredient] = useState<IngredientsRow | null>(null);
  const [deletingIngredient, setDeletingIngredient] = useState<IngredientsRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lowStockCount = ingredients.filter((i) => i.stock_quantity < i.min_threshold).length;

  function handleAddNew() {
    setEditingIngredient(null);
    setFormOpen(true);
  }

  function handleEdit(ingredient: IngredientsRow) {
    setEditingIngredient(ingredient);
    setFormOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingIngredient) return;
    setDeleting(true);
    try {
      await deleteIngredient(deletingIngredient.id);
      toast.success("Đã xoá nguyên liệu.");
      setDeletingIngredient(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá nguyên liệu.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Quản lý kho</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi tồn kho, nhập thêm hàng và quản lý công thức từng món.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm nguyên liệu
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Tổng số nguyên liệu" value={`${ingredients.length}`} icon={Package} />
        <StatCard
          label="Sắp/đã hết hàng"
          value={`${lowStockCount}`}
          icon={AlertTriangle}
          className={lowStockCount > 0 ? "border-destructive/50 bg-destructive/5" : undefined}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <Label htmlFor="block-toggle" className="cursor-pointer font-medium">
            Chặn khi thiếu nguyên liệu
          </Label>
          <p className="text-xs text-muted-foreground">
            Khi bật: bếp KHÔNG thể bắt đầu làm món nếu không đủ nguyên liệu trong kho. Khi tắt: vẫn cho làm và trừ
            kho (có thể âm), chỉ hiện cảnh báo.
          </p>
        </div>
        <Switch
          id="block-toggle"
          checked={settings?.block_order_when_insufficient_stock ?? false}
          disabled={settingsLoading || updating}
          onCheckedChange={(checked) => void toggleBlockWhenInsufficientStock(checked)}
        />
      </div>

      <IngredientTable
        ingredients={ingredients}
        loading={loading}
        onRestock={setRestockingIngredient}
        onEdit={handleEdit}
        onDelete={setDeletingIngredient}
      />

      <RecipeEditor ingredients={ingredients} />

      <IngredientFormDialog
        open={formOpen}
        ingredient={editingIngredient}
        onOpenChange={setFormOpen}
        onSaved={refetch}
      />

      <RestockDialog
        open={restockingIngredient !== null}
        ingredient={restockingIngredient}
        onOpenChange={(open) => !open && setRestockingIngredient(null)}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={deletingIngredient !== null}
        title="Xoá nguyên liệu?"
        description={`Nguyên liệu "${deletingIngredient?.name ?? ""}" sẽ bị xoá khỏi kho và khỏi công thức của mọi món đang dùng nó.`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeletingIngredient(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
