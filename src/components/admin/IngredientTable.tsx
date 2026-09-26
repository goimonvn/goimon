"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { IngredientsRow } from "@/types/database.types";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

interface IngredientTableProps {
  ingredients: IngredientsRow[];
  loading: boolean;
  onRestock: (ingredient: IngredientsRow) => void;
  onEdit: (ingredient: IngredientsRow) => void;
  onDelete: (ingredient: IngredientsRow) => void;
}

/** Bảng danh sách nguyên liệu trong kho, tô đỏ dòng nào dưới ngưỡng cảnh báo. */
export function IngredientTable({ ingredients, loading, onRestock, onEdit, onDelete }: IngredientTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có nguyên liệu nào. Bấm &quot;Thêm nguyên liệu&quot; để bắt đầu quản lý kho.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nguyên liệu</th>
            <th className="px-4 py-3 text-right font-medium">Tồn kho</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Ngưỡng cảnh báo</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Giá vốn BQ</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient) => {
            const isLow = ingredient.stock_quantity < ingredient.min_threshold;
            return (
              <tr key={ingredient.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{ingredient.name}</div>
                  <div className="text-xs text-muted-foreground">{ingredient.unit}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={isLow ? "font-semibold text-destructive" : "font-medium"}>
                    {ingredient.stock_quantity}
                  </span>
                  {isLow && (
                    <Badge variant="destructive" className="ml-2 align-middle">
                      Sắp hết
                    </Badge>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {ingredient.min_threshold}
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                  {/* avg_cost = 0 nghĩa là nguyên liệu này CHƯA từng được ghi qua phiếu nhập hàng nào (Module 20) — chỉ RestockDialog/"Nhập kho nhanh" thì không tính giá vốn, xem schema.sql. */}
                  {ingredient.avg_cost > 0 ? formatCurrency(ingredient.avg_cost) : "Chưa có"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => onRestock(ingredient)}>
                      <PlusCircle className="mr-1 h-3.5 w-3.5" />
                      Nhập kho
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onEdit(ingredient)} aria-label="Sửa">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(ingredient)}
                      aria-label="Xoá"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
