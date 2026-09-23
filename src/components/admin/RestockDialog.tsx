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
import { restockIngredient } from "@/services/inventory.service";
import type { IngredientsRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface RestockDialogProps {
  open: boolean;
  ingredient: IngredientsRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Dialog nhập thêm hàng — cộng nguyên tử vào tồn kho qua RPC `adjust_ingredient_stock`. */
export function RestockDialog({ open, ingredient, onOpenChange, onSaved }: RestockDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setQuantity("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ingredient) return;

    const quantityNumber = Number(quantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      toast.error("Số lượng nhập kho phải lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      await restockIngredient({ ingredientId: ingredient.id, quantityToAdd: quantityNumber });
      toast.success(`Đã nhập thêm ${quantityNumber} ${ingredient.unit} ${ingredient.name}.`);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể nhập kho.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập kho — {ingredient?.name ?? ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tồn kho hiện tại:{" "}
            <span className="font-medium text-foreground">
              {ingredient?.stock_quantity ?? 0} {ingredient?.unit ?? ""}
            </span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="restock-quantity">Số lượng nhập thêm ({ingredient?.unit ?? ""})</Label>
            <Input
              id="restock-quantity"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Nhập kho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
