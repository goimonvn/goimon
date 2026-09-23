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
import { createCategory, updateCategory } from "@/services/menu.service";
import type { CategoriesRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type CategorySummary = Pick<CategoriesRow, "id" | "name" | "display_order">;

interface CategoryFormDialogProps {
  open: boolean;
  category: CategorySummary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Form thêm/sửa danh mục món — dùng chung 1 component cho cả 2 thao tác, phân biệt qua `category` (null = tạo mới). */
export function CategoryFormDialog({ open, category, onOpenChange, onSaved }: CategoryFormDialogProps) {
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setDisplayOrder(category ? String(category.display_order) : "0");
    }
  }, [open, category]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên danh mục.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: trimmedName, displayOrder: Number(displayOrder) || 0 };
      if (category) {
        await updateCategory(category.id, input);
        toast.success("Đã cập nhật danh mục.");
      } else {
        await createCategory(input);
        toast.success("Đã tạo danh mục mới.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu danh mục.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Sửa danh mục" : "Thêm danh mục mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Tên danh mục</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Cà phê, Trà trái cây..."
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-order">Thứ tự hiển thị</Label>
            <Input
              id="category-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Số nhỏ hơn hiển thị trước trên menu khách hàng.</p>
          </div>
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
