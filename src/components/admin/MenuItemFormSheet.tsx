"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import {
  createItemOption,
  createMenuItem,
  deleteItemOption,
  updateItemOption,
  updateMenuItem,
} from "@/services/menu.service";
import { STATION_TYPE_LABEL, type MenuItemWithOptions } from "@/types";
import type { ItemOptionsRow, StationType } from "@/types/database.types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface CategoryOption {
  id: string;
  name: string;
}

interface MenuItemFormSheetProps {
  open: boolean;
  /** null = đang tạo món mới. Sau khi tạo thành công, cha nên trỏ prop này sang món vừa tạo để bật khu vực quản lý option. */
  item: MenuItemWithOptions | null;
  categories: CategoryOption[];
  defaultCategoryId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (newItemId: string) => void;
  onSaved: () => void;
}

/**
 * Sheet thêm/sửa món. Khu vực quản lý option (topping) chỉ khả dụng khi món
 * đã tồn tại trong DB (item_options tham chiếu menu_item_id) — với món mới,
 * lưu thông tin cơ bản trước, cha sẽ trỏ `item` sang bản ghi vừa tạo để mở
 * khoá phần thêm option ngay trong cùng 1 lần mở sheet.
 */
export function MenuItemFormSheet({
  open,
  item,
  categories,
  defaultCategoryId,
  onOpenChange,
  onCreated,
  onSaved,
}: MenuItemFormSheetProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [stationType, setStationType] = useState<StationType>("kitchen");
  const [isAvailable, setIsAvailable] = useState(true);
  const [autoResetDaily, setAutoResetDaily] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("0");
  const [addingOption, setAddingOption] = useState(false);
  const [deletingOption, setDeletingOption] = useState<ItemOptionsRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setPrice(item ? String(item.price) : "0");
    setImageUrl(item?.image_url ?? "");
    setCategoryId(item?.category_id ?? defaultCategoryId);
    setStationType(item?.station_type ?? "kitchen");
    setIsAvailable(item?.is_available ?? true);
    setAutoResetDaily(item?.auto_reset_daily ?? true);
    setNewOptionName("");
    setNewOptionPrice("0");
  }, [open, item, defaultCategoryId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên món.");
      return;
    }
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      toast.error("Giá món không hợp lệ.");
      return;
    }
    if (!categoryId) {
      toast.error("Vui lòng chọn danh mục.");
      return;
    }

    const input = {
      categoryId,
      name: trimmedName,
      price: priceNumber,
      imageUrl: imageUrl.trim() || null,
      stationType,
      isAvailable,
      autoResetDaily,
    };

    setSubmitting(true);
    try {
      if (item) {
        await updateMenuItem(item.id, input);
        toast.success("Đã cập nhật món.");
        onSaved();
      } else {
        const created = await createMenuItem(input);
        toast.success("Đã tạo món mới. Bạn có thể thêm topping/option bên dưới.");
        onSaved();
        onCreated(created.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu món.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddOption() {
    if (!item) return;
    const trimmed = newOptionName.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập tên option.");
      return;
    }
    setAddingOption(true);
    try {
      await createItemOption(item.id, trimmed, Number(newOptionPrice) || 0);
      toast.success("Đã thêm option.");
      setNewOptionName("");
      setNewOptionPrice("0");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm option.");
    } finally {
      setAddingOption(false);
    }
  }

  async function handleConfirmDeleteOption() {
    if (!deletingOption) return;
    try {
      await deleteItemOption(deletingOption.id);
      toast.success("Đã xoá option.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá option.");
    } finally {
      setDeletingOption(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{item ? "Sửa món" : "Thêm món mới"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Tên món</Label>
              <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">Giá bán (đ)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Khu vực chế biến</Label>
                <Select value={stationType} onValueChange={(v) => setStationType(v as StationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATION_TYPE_LABEL) as StationType[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {STATION_TYPE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Danh mục</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-image">Ảnh món (URL)</Label>
              <Input
                id="item-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="item-available"
                checked={isAvailable}
                onCheckedChange={(c) => setIsAvailable(c === true)}
              />
              <Label htmlFor="item-available" className="cursor-pointer font-normal">
                Còn hàng (hiển thị cho khách đặt)
              </Label>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-dashed p-3">
              <div>
                <Label htmlFor="item-auto-reset" className="cursor-pointer font-normal">
                  Tự động bật lại mỗi sáng
                </Label>
                <p className="text-xs text-muted-foreground">
                  Vercel Cron sẽ tự đặt lại &quot;còn hàng&quot; cho món này mỗi sáng, kể cả khi bị tắt hôm trước.
                </p>
              </div>
              <Switch id="item-auto-reset" checked={autoResetDaily} onCheckedChange={setAutoResetDaily} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Đang lưu..." : item ? "Lưu thay đổi" : "Tạo món"}
            </Button>
          </form>

          <div className="border-t p-4">
            <p className="mb-3 text-sm font-medium">Topping / Option</p>
            {!item ? (
              <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                Lưu món ở trên trước, sau đó bạn có thể thêm topping/option tại đây.
              </p>
            ) : (
              <div className="space-y-3">
                {item.options.length === 0 && (
                  <p className="text-xs text-muted-foreground">Món này chưa có option nào.</p>
                )}
                <ul className="space-y-2">
                  {item.options.map((option) => (
                    <li
                      key={option.id}
                      className="flex items-center justify-between gap-2 rounded-xl border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{option.option_name}</p>
                        <p className="text-xs text-muted-foreground">
                          +{formatCurrency(option.additional_price)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingOption(option)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-end gap-2 rounded-xl border border-dashed p-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="new-option-name" className="text-xs">
                      Tên option mới
                    </Label>
                    <Input
                      id="new-option-name"
                      value={newOptionName}
                      onChange={(e) => setNewOptionName(e.target.value)}
                      placeholder="Ví dụ: Thêm trân châu"
                      className="h-9"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label htmlFor="new-option-price" className="text-xs">
                      Phụ thu
                    </Label>
                    <Input
                      id="new-option-price"
                      type="number"
                      min={0}
                      value={newOptionPrice}
                      onChange={(e) => setNewOptionPrice(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    disabled={addingOption}
                    onClick={() => void handleAddOption()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="border-t bg-background">
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deletingOption !== null}
        title="Xoá option?"
        description={`Option "${deletingOption?.option_name ?? ""}" sẽ bị xoá khỏi món này.`}
        onOpenChange={(open) => !open && setDeletingOption(null)}
        onConfirm={() => void handleConfirmDeleteOption()}
      />
    </>
  );
}
