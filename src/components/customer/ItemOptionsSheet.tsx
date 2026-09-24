"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { MenuItemWithOptions } from "@/types";
import type { ItemOptionsRow } from "@/types/database.types";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ItemOptionsSheetProps {
  item: MenuItemWithOptions | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    quantity: number;
    selectedOptions: ItemOptionsRow[];
    note: string;
  }) => void;
}

/**
 * Bottom sheet chọn topping/option, số lượng và ghi chú trước khi thêm vào giỏ.
 * Option được thiết kế dạng multi-select (checkbox) vì đúng bản chất "topping"
 * của đồ uống quán cà phê (nhiều topping cộng dồn additional_price).
 */
export function ItemOptionsSheet({ item, onOpenChange, onConfirm }: ItemOptionsSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedOptionIds(new Set());
      setNote("");
    }
  }, [item]);

  const selectedOptions = useMemo(
    () => item?.options.filter((o) => selectedOptionIds.has(o.id)) ?? [],
    [item, selectedOptionIds]
  );

  const unitPrice = useMemo(
    () => (item?.price ?? 0) + selectedOptions.reduce((sum, o) => sum + o.additional_price, 0),
    [item, selectedOptions]
  );

  function toggleOption(optionId: string) {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col p-0"
        // Mặc định Radix tự focus vào phần tử focusable ĐẦU TIÊN khi sheet mở
        // — với món KHÔNG có topping, đó là ô "Ghi chú" (Textarea), khiến bàn
        // phím ảo bật lên NGAY LẬP TỨC che mất nội dung trên di động (khách
        // chưa kịp thấy tên món/giá đã bị bàn phím che). Chặn hành vi này lại
        // vì đây là bottom sheet cho khách hàng trên di động, không phải form
        // nhập liệu nhanh trên desktop (khác các Sheet quản trị vẫn cố ý dùng
        // `autoFocus`, vd `MenuItemFormSheet.tsx`).
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{item.name}</SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {item.options.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Topping thêm</p>
                  {item.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border p-3"
                    >
                      <span className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedOptionIds.has(option.id)}
                          onCheckedChange={() => toggleOption(option.id)}
                        />
                        <span className="text-sm">{option.option_name}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        +{formatCurrency(option.additional_price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú cho quán (không bắt buộc)</Label>
                <Textarea
                  id="note"
                  placeholder="Ví dụ: ít đá, không đường..."
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Số lượng</span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Giảm số lượng"
                  >
                    <Minus />
                  </Button>
                  <span className="w-6 text-center text-base font-semibold">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                    aria-label="Tăng số lượng"
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            </div>

            <SheetFooter className="border-t bg-background">
              <Button
                size="lg"
                onClick={() => {
                  onConfirm({ quantity, selectedOptions, note });
                  onOpenChange(false);
                }}
              >
                Thêm vào giỏ · {formatCurrency(unitPrice * quantity)}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
