"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import type { ComboWithItems } from "@/types";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface ComboDetailSheetProps {
  combo: ComboWithItems | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number) => void;
}

/**
 * Bottom sheet xem chi tiết 1 combo (danh sách món thành phần) + chọn số
 * lượng GÓI combo muốn thêm — KHÔNG cho tuỳ chỉnh từng món bên trong (đúng
 * yêu cầu "thêm nguyên gói combo"), khác ItemOptionsSheet ở chỗ không có
 * topping/ghi chú. Xem CartContext.addComboLines cho cách 1 gói được "nổ"
 * thành nhiều CartLine khi xác nhận.
 */
export function ComboDetailSheet({ combo, onOpenChange, onConfirm }: ComboDetailSheetProps) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (combo) setQuantity(1);
  }, [combo]);

  return (
    <Sheet open={combo !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col p-0">
        {combo && (
          <>
            <SheetHeader>
              <SheetTitle>{combo.name}</SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {combo.description && <p className="text-sm text-muted-foreground">{combo.description}</p>}

              <div className="space-y-2">
                <p className="text-sm font-medium">Combo gồm có</p>
                <ul className="space-y-1.5">
                  {combo.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border p-3 text-sm"
                    >
                      <span>{item.menuItem.name}</span>
                      <span className="font-semibold text-muted-foreground">x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Số lượng combo</span>
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
                  onConfirm(quantity);
                  onOpenChange(false);
                }}
              >
                Thêm vào giỏ · {formatCurrency(combo.price * quantity)}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
