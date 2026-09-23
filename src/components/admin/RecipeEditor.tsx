"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu } from "@/hooks/useMenu";
import {
  addRecipeItem,
  getRecipeForMenuItem,
  removeRecipeItem,
  updateRecipeItemQuantity,
} from "@/services/inventory.service";
import type { RecipeItemWithIngredient } from "@/types";
import type { IngredientsRow } from "@/types/database.types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface RecipeEditorProps {
  ingredients: IngredientsRow[];
}

/** Chỉnh sửa công thức (định lượng nguyên liệu) của từng món trong menu. */
export function RecipeEditor({ ingredients }: RecipeEditorProps) {
  const { categories, loading: menuLoading } = useMenu();
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [recipeItems, setRecipeItems] = useState<RecipeItemWithIngredient[]>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [newIngredientId, setNewIngredientId] = useState<string>("");
  const [newQuantity, setNewQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingItem, setRemovingItem] = useState<RecipeItemWithIngredient | null>(null);
  const [removing, setRemoving] = useState(false);

  const menuItems = useMemo(
    () =>
      categories.flatMap((category) =>
        category.items.map((item) => ({ id: item.id, name: item.name, categoryName: category.name }))
      ),
    [categories]
  );

  async function loadRecipe(menuItemId: string) {
    setLoadingRecipe(true);
    try {
      const data = await getRecipeForMenuItem(menuItemId);
      setRecipeItems(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải công thức.");
    } finally {
      setLoadingRecipe(false);
    }
  }

  useEffect(() => {
    if (!selectedMenuItemId) {
      setRecipeItems([]);
      return;
    }
    void loadRecipe(selectedMenuItemId);
  }, [selectedMenuItemId]);

  const availableIngredients = ingredients.filter(
    (ingredient) => !recipeItems.some((line) => line.ingredient_id === ingredient.id)
  );

  async function handleAddIngredient() {
    if (!selectedMenuItemId) return;
    if (!newIngredientId) {
      toast.error("Vui lòng chọn nguyên liệu.");
      return;
    }
    const quantityNumber = Number(newQuantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      toast.error("Định lượng phải lớn hơn 0.");
      return;
    }

    setAdding(true);
    try {
      await addRecipeItem(selectedMenuItemId, newIngredientId, quantityNumber);
      setNewIngredientId("");
      setNewQuantity("");
      await loadRecipe(selectedMenuItemId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm nguyên liệu vào công thức.");
    } finally {
      setAdding(false);
    }
  }

  function handleQuantityChange(line: RecipeItemWithIngredient, value: string) {
    const quantityNumber = Number(value);
    setRecipeItems((prev) =>
      prev.map((item) => (item.id === line.id ? { ...item, quantity_required: quantityNumber } : item))
    );
  }

  async function handleQuantityCommit(line: RecipeItemWithIngredient) {
    if (!Number.isFinite(line.quantity_required) || line.quantity_required <= 0) {
      toast.error("Định lượng phải lớn hơn 0.");
      if (selectedMenuItemId) void loadRecipe(selectedMenuItemId);
      return;
    }
    try {
      await updateRecipeItemQuantity(line.id, line.quantity_required);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật định lượng.");
      if (selectedMenuItemId) void loadRecipe(selectedMenuItemId);
    }
  }

  async function handleConfirmRemove() {
    if (!removingItem) return;
    setRemoving(true);
    try {
      await removeRecipeItem(removingItem.id);
      toast.success("Đã xoá nguyên liệu khỏi công thức.");
      setRemovingItem(null);
      if (selectedMenuItemId) await loadRecipe(selectedMenuItemId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div>
        <p className="mb-2 text-sm font-medium">Công thức món ăn</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Chọn 1 món để xem/chỉnh định lượng nguyên liệu — hệ thống sẽ tự trừ kho theo công thức này khi bếp bắt
          đầu làm món.
        </p>
        {menuLoading ? (
          <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
        ) : (
          <Select value={selectedMenuItemId} onValueChange={setSelectedMenuItemId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Chọn món trong menu..." />
            </SelectTrigger>
            <SelectContent>
              {menuItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}{" "}
                  <span className="text-xs text-muted-foreground">({item.categoryName})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedMenuItemId && (
        <div className="space-y-3 border-t pt-4">
          {loadingRecipe ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <>
              {recipeItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Món này chưa có công thức nào.</p>
              ) : (
                <ul className="space-y-2">
                  {recipeItems.map((line) => (
                    <li key={line.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{line.ingredientName}</p>
                        <p className="text-xs text-muted-foreground">{line.ingredientUnit}</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity_required}
                        onChange={(e) => handleQuantityChange(line, e.target.value)}
                        onBlur={() => void handleQuantityCommit(line)}
                        className="h-9 w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemovingItem(line)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end gap-2 rounded-xl border border-dashed p-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs">Thêm nguyên liệu</Label>
                  <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Chọn nguyên liệu..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIngredients.map((ingredient) => (
                        <SelectItem key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} ({ingredient.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Định lượng</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button type="button" size="icon" disabled={adding} onClick={() => void handleAddIngredient()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removingItem !== null}
        title="Xoá nguyên liệu khỏi công thức?"
        description={`Món sẽ không còn tự động trừ kho "${removingItem?.ingredientName ?? ""}" nữa.`}
        submitting={removing}
        onOpenChange={(open) => !open && setRemovingItem(null)}
        onConfirm={() => void handleConfirmRemove()}
      />
    </div>
  );
}
