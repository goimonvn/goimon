"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import type { ComboWithItems } from "@/types";
import { Pencil, Trash2 } from "lucide-react";

interface CombosTableProps {
  combos: ComboWithItems[];
  loading: boolean;
  onToggleActive: (combo: ComboWithItems, isActive: boolean) => void;
  onEdit: (combo: ComboWithItems) => void;
  onDelete: (combo: ComboWithItems) => void;
}

/** Bảng danh sách combo — bao gồm cả combo đã tắt (chỉ admin xem được đầy đủ, xem RLS trong schema.sql). */
export function CombosTable({ combos, loading, onToggleActive, onEdit, onDelete }: CombosTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (combos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có combo nào. Bấm &quot;Thêm combo&quot; để bắt đầu.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Combo</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Món thành phần</th>
            <th className="px-4 py-3 text-right font-medium">Giá</th>
            <th className="px-4 py-3 font-medium">Hiển thị</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {combos.map((combo) => (
            <tr key={combo.id} className="border-t">
              <td className="px-4 py-3">
                <div className="font-medium">{combo.name}</div>
                {combo.description && (
                  <div className="max-w-xs truncate text-xs text-muted-foreground">{combo.description}</div>
                )}
              </td>
              <td className="hidden max-w-xs px-4 py-3 text-xs text-muted-foreground md:table-cell">
                {combo.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-primary">
                {formatCurrency(combo.price)}
              </td>
              <td className="px-4 py-3">
                <Switch
                  checked={combo.is_active}
                  onCheckedChange={(checked) => onToggleActive(combo, checked)}
                  aria-label={combo.is_active ? "Đang hiển thị" : "Đang ẩn"}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(combo)} aria-label="Sửa">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(combo)}
                    aria-label="Xoá"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
