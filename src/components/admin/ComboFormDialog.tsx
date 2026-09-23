"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useMenu } from "@/hooks/useMenu";
import { saveCombo } from "@/services/combo.service";
import type { ComboFormInput, ComboItemDraft, ComboWithItems } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface ComboFormDialogProps {
  open: boolean;
  /** null = đang tạo combo mới. */
  combo: ComboWithItems | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Form thêm/sửa combo — MỘT dialog duy nhất gồm 2 phần: thông tin cơ bản
 * (tên/mô tả/giá/ảnh/hiển thị) + danh sách món thành phần đang soạn CỤC BỘ
 * (chưa lưu DB, kiểu picker giống RecipeEditor nhưng KHÔNG ghi trực tiếp
 * từng dòng — chỉ ghi 1 LẦN DUY NHẤT khi bấm "Lưu", xem
 * combo.service.ts#saveCombo — replace toàn bộ combo_items).
 */
export function ComboFormDialog({ open, combo, onOpenChange, onSaved }: ComboFormDialogProps) {
  const { categories, loading: menuLoading } = useMenu();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [draftItems, setDraftItems] = useState<ComboItemDraft[]>([]);
  const [newMenuItemId, setNewMenuItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const menuItems = useMemo(
    () =>
      categories.flatMap((category) =>
        category.items.map((item) => ({ id: item.id, name: item.name, categoryName: category.name }))
      ),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    setName(combo?.name ?? "");
    setDescription(combo?.description ?? "");
    setPrice(combo ? String(combo.price) : "0");
    setImageUrl(combo?.image_url ?? "");
    setIsActive(combo?.is_active ?? true);
    setDisplayOrder(combo ? String(combo.display_order) : "0");
    setDraftItems(
      combo?.items.map((item) => ({
        menuItemId: item.menuItem.id,
        menuItemName: item.menuItem.name,
        quantity: item.quantity,
      })) ?? []
    );
    setNewMenuItemId("");
    setNewQuantity("1");
  }, [open, combo]);

  const availableMenuItems = menuItems.filter(
    (item) => !draftItems.some((draft) => draft.menuItemId === item.id)
  );

  function handleAddDraftItem() {
    if (!newMenuItemId) {
      toast.error("Vui lòng chọn món để thêm vào combo.");
      return;
    }
    const quantityNumber = Number(newQuantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }
    const menuItem = menuItems.find((item) => item.id === newMenuItemId);
    if (!menuItem) return;

    setDraftItems((prev) => [...prev, { menuItemId: menuItem.id, menuItemName: menuItem.name, quantity: quantityNumber }]);
    setNewMenuItemId("");
    setNewQuantity("1");
  }

  function handleRemoveDraftItem(menuItemId: string) {
    setDraftItems((prev) => prev.filter((item) => item.menuItemId !== menuItemId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên combo.");
      return;
    }
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      toast.error("Giá combo không hợp lệ.");
      return;
    }
    const displayOrderNumber = Number(displayOrder);
    if (!Number.isFinite(displayOrderNumber)) {
      toast.error("Thứ tự hiển thị không hợp lệ.");
      return;
    }
    if (draftItems.length === 0) {
      toast.error("Combo cần có ít nhất 1 món thành phần.");
      return;
    }

    const input: ComboFormInput = {
      name: trimmedName,
      description: description.trim(),
      price: priceNumber,
      imageUrl: imageUrl.trim() || null,
      isActive,
      displayOrder: displayOrderNumber,
      items: draftItems,
    };

    setSubmitting(true);
    try {
      await saveCombo(combo?.id ?? null, input);
      toast.success(combo ? "Đã cập nhật combo." : "Đã tạo combo mới.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu combo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{combo ? "Sửa combo" : "Thêm combo mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="combo-name">Tên combo</Label>
            <Input
              id="combo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Combo Sáng Năng Lượng"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="combo-description">Mô tả (không bắt buộc)</Label>
            <Textarea
              id="combo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: 1 cà phê sữa + 1 bánh mì que, tiết kiệm hơn gọi lẻ"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="combo-price">Giá combo (đ)</Label>
              <Input
                id="combo-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="combo-display-order">Thứ tự hiển thị</Label>
              <Input
                id="combo-display-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="combo-image-url">Ảnh combo (URL, không bắt buộc)</Label>
            <Input
              id="combo-image-url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="combo-is-active" checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
            <Label htmlFor="combo-is-active" className="cursor-pointer font-normal">
              Hiển thị combo này cho khách ngay
            </Label>
          </div>

          <div className="space-y-2 rounded-xl border border-dashed p-3">
            <p className="text-sm font-medium">Món thành phần</p>

            {draftItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có món nào — thêm ít nhất 1 món bên dưới.</p>
            ) : (
              <ul className="space-y-2">
                {draftItems.map((item) => (
                  <li
                    key={item.menuItemId}
                    className="flex items-center justify-between gap-2 rounded-xl border p-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{item.menuItemName}</span>
                    <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDraftItem(item.menuItemId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {menuLoading ? (
              <Skeleton className="h-9 w-full rounded-xl" />
            ) : (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs">Thêm món</Label>
                  <Select value={newMenuItemId} onValueChange={setNewMenuItemId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Chọn món trong menu..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMenuItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} <span className="text-xs text-muted-foreground">({item.categoryName})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">SL</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button type="button" size="icon" onClick={handleAddDraftItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
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
