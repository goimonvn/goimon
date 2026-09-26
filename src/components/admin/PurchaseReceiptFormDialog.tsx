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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIngredients } from "@/hooks/useIngredients";
import { useSuppliers } from "@/hooks/useSuppliers";
import { shopDateString } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { recordPurchaseReceipt } from "@/services/purchasing.service";
import type { PurchaseReceiptFormInput, PurchaseReceiptItemDraft } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface PurchaseReceiptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Form ghi 1 phiếu nhập hàng — CHỈ TẠO (không có prop `receipt` để sửa, khác
 * ComboFormDialog/ZoneFormDialog — phiếu nhập hàng là sổ sách bất biến, xem
 * ghi chú ở purchasing.service.ts#recordPurchaseReceipt). Danh sách nguyên
 * liệu đang soạn CỤC BỘ (chưa lưu DB, kiểu picker giống ComboFormDialog)
 * nhưng thêm `unitCost` mỗi dòng — chỉ ghi 1 LẦN DUY NHẤT khi bấm "Lưu",
 * gửi nguyên mảng cho RPC `record_purchase_receipt` để cộng kho + cập nhật
 * giá vốn bình quân atomic.
 */
export function PurchaseReceiptFormDialog({ open, onOpenChange, onSaved }: PurchaseReceiptFormDialogProps) {
  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { ingredients, loading: ingredientsLoading } = useIngredients();

  const [supplierId, setSupplierId] = useState("");
  const [receiptDate, setReceiptDate] = useState(shopDateString());
  const [note, setNote] = useState("");
  const [draftItems, setDraftItems] = useState<PurchaseReceiptItemDraft[]>([]);
  const [newIngredientId, setNewIngredientId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitCost, setNewUnitCost] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const availableIngredients = ingredients.filter(
    (ingredient) => !draftItems.some((draft) => draft.ingredientId === ingredient.id)
  );

  const total = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [draftItems]
  );

  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setReceiptDate(shopDateString());
    setNote("");
    setDraftItems([]);
    setNewIngredientId("");
    setNewQuantity("1");
    setNewUnitCost("0");
  }, [open]);

  function handleAddDraftItem() {
    if (!newIngredientId) {
      toast.error("Vui lòng chọn nguyên liệu để thêm vào phiếu.");
      return;
    }
    const quantityNumber = Number(newQuantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      toast.error("Số lượng nhập phải lớn hơn 0.");
      return;
    }
    const unitCostNumber = Number(newUnitCost);
    if (!Number.isFinite(unitCostNumber) || unitCostNumber < 0) {
      toast.error("Đơn giá nhập không hợp lệ.");
      return;
    }
    const ingredient = ingredients.find((i) => i.id === newIngredientId);
    if (!ingredient) return;

    setDraftItems((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        ingredientUnit: ingredient.unit,
        quantity: quantityNumber,
        unitCost: unitCostNumber,
      },
    ]);
    setNewIngredientId("");
    setNewQuantity("1");
    setNewUnitCost("0");
  }

  function handleRemoveDraftItem(ingredientId: string) {
    setDraftItems((prev) => prev.filter((item) => item.ingredientId !== ingredientId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Vui lòng chọn nhà cung cấp.");
      return;
    }
    if (!receiptDate) {
      toast.error("Vui lòng chọn ngày nhập hàng.");
      return;
    }
    if (draftItems.length === 0) {
      toast.error("Phiếu nhập hàng cần có ít nhất 1 dòng nguyên liệu.");
      return;
    }

    const input: PurchaseReceiptFormInput = {
      supplierId,
      receiptDate,
      note,
      items: draftItems,
    };

    setSubmitting(true);
    try {
      await recordPurchaseReceipt(input);
      toast.success("Đã ghi phiếu nhập hàng — kho và giá vốn đã được cập nhật.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu phiếu nhập hàng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi phiếu nhập hàng</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nhà cung cấp</Label>
              {suppliersLoading ? (
                <Skeleton className="h-11 w-full rounded-xl" />
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhà cung cấp..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-date">Ngày nhập hàng</Label>
              <Input
                id="receipt-date"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
          </div>

          {suppliers.length === 0 && !suppliersLoading && (
            <p className="text-xs text-muted-foreground">
              Chưa có nhà cung cấp nào — thêm nhà cung cấp ở bảng bên dưới trước khi ghi phiếu.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="receipt-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="receipt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Hoá đơn số..., nhập bù đợt trước..."
            />
          </div>

          <div className="space-y-2 rounded-xl border border-dashed p-3">
            <p className="text-sm font-medium">Danh sách nguyên liệu nhập</p>

            {draftItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có dòng nào — thêm ít nhất 1 nguyên liệu bên dưới.</p>
            ) : (
              <ul className="space-y-2">
                {draftItems.map((item) => (
                  <li
                    key={item.ingredientId}
                    className="flex items-center justify-between gap-2 rounded-xl border p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{item.ingredientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} {item.ingredientUnit} × {formatCurrency(item.unitCost)} ={" "}
                        {formatCurrency(item.quantity * item.unitCost)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDraftItem(item.ingredientId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {ingredientsLoading ? (
              <Skeleton className="h-9 w-full rounded-xl" />
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[9rem] flex-1 space-y-1">
                  <Label className="text-xs">Nguyên liệu</Label>
                  <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Chọn..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIngredients.map((ingredient) => (
                        <SelectItem key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} <span className="text-xs text-muted-foreground">({ingredient.unit})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">SL</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Đơn giá (đ)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newUnitCost}
                    onChange={(e) => setNewUnitCost(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button type="button" size="icon" onClick={handleAddDraftItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {draftItems.length > 0 && (
              <p className="pt-1 text-right text-sm font-medium">Tổng tiền phiếu: {formatCurrency(total)}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu phiếu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
