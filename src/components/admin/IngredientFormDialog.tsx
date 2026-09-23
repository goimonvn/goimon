"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIngredient, updateIngredientDetails } from "@/services/inventory.service";
import type { IngredientsRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface IngredientFormDialogProps {
  open: boolean;
  /** null = đang tạo nguyên liệu mới. */
  ingredient: IngredientsRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Form thêm/sửa nguyên liệu — CHỈ quản lý tên/đơn vị/ngưỡng cảnh báo.
 * `stock_quantity` (tồn kho) KHÔNG sửa ở đây: nhập thêm hàng dùng
 * `RestockDialog` (cộng nguyên tử qua RPC), trừ kho do hệ thống tự động xử
 * lý khi KDS đổi trạng thái món — tránh 2 nơi cùng ghi trực tiếp lên tồn kho
 * gây sai lệch số liệu.
 */
export function IngredientFormDialog({ open, ingredient, onOpenChange, onSaved }: IngredientFormDialogProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minThreshold, setMinThreshold] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(ingredient?.name ?? "");
    setUnit(ingredient?.unit ?? "");
    setMinThreshold(ingredient ? String(ingredient.min_threshold) : "0");
  }, [open, ingredient]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên nguyên liệu.");
      return;
    }
    if (!trimmedUnit) {
      toast.error("Vui lòng nhập đơn vị tính (gram, ml, cái...).");
      return;
    }
    const minThresholdNumber = Number(minThreshold);
    if (!Number.isFinite(minThresholdNumber) || minThresholdNumber < 0) {
      toast.error("Ngưỡng cảnh báo không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: trimmedName, unit: trimmedUnit, minThreshold: minThresholdNumber };
      if (ingredient) {
        await updateIngredientDetails(ingredient.id, input);
        toast.success("Đã cập nhật nguyên liệu.");
      } else {
        await createIngredient(input);
        toast.success("Đã thêm nguyên liệu mới.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu nguyên liệu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ingredient ? "Sửa nguyên liệu" : "Thêm nguyên liệu mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ingredient-name">Tên nguyên liệu</Label>
            <Input
              id="ingredient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Sữa tươi, Hạt cà phê..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ingredient-unit">Đơn vị tính</Label>
              <Input
                id="ingredient-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="gram, ml, cái..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ingredient-threshold">Ngưỡng cảnh báo</Label>
              <Input
                id="ingredient-threshold"
                type="number"
                min={0}
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Khi tồn kho thấp hơn ngưỡng này, nguyên liệu sẽ hiện cảnh báo &quot;Sắp hết&quot; trên Dashboard.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
