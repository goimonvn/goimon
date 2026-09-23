"use client";

import { formatCurrency } from "@/lib/utils";
import type { CartLine } from "@/types";
import { Trash2 } from "lucide-react";

interface ComboCartCardProps {
  /** Toàn bộ CartLine cùng 1 comboGroupId (đã lọc sẵn ở caller) — LUÔN có ít nhất 1 dòng. */
  groupLines: CartLine[];
  onRemove: (comboGroupId: string) => void;
}

/**
 * "Thẻ combo" trong giỏ hàng — gộp hiển thị TOÀN BỘ các CartLine nổ ra từ
 * cùng 1 lần "Thêm combo vào giỏ" thành 1 khối duy nhất (tên combo + tổng giá
 * + danh sách món thành phần), thay vì render rời rạc từng CartLineRow (sẽ
 * lộ ra các dòng 0đ gây khó hiểu — xem ghi chú ở CartContext.addComboLines).
 * KHÔNG cho chỉnh số lượng từng thành phần — chỉ xoá nguyên combo.
 */
export function ComboCartCard({ groupLines, onRemove }: ComboCartCardProps) {
  const first = groupLines[0];
  const comboGroupId = first.comboGroupId;
  if (!comboGroupId) return null;

  const totalAmount = groupLines.reduce((sum, l) => sum + l.lineTotal, 0);

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="inline-block rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
            COMBO
          </p>
          <p className="mt-1 text-sm font-semibold">{first.comboName}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(comboGroupId)}
          aria-label="Xoá combo"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ul className="mt-2 space-y-1">
        {groupLines.map((line) => (
          <li key={line.cartLineId} className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{line.menuItem.name}</span>
            <span>x{line.quantity}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-right text-sm font-semibold text-primary">{formatCurrency(totalAmount)}</p>
    </div>
  );
}
