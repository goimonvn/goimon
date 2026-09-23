"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { CartLine } from "@/types";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartLineRowProps {
  line: CartLine;
  onChangeQuantity: (cartLineId: string, quantity: number) => void;
  onRemove: (cartLineId: string) => void;
}

export function CartLineRow({ line, onChangeQuantity, onRemove }: CartLineRowProps) {
  return (
    <div className="flex gap-3 rounded-2xl border p-3">
      <div className="flex-1">
        <p className="text-sm font-medium">{line.menuItem.name}</p>
        {line.selectedOptions.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {line.selectedOptions.map((o) => o.option_name).join(", ")}
          </p>
        )}
        {line.note && <p className="mt-0.5 text-xs italic text-muted-foreground">"{line.note}"</p>}
        <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(line.lineTotal)}</p>
      </div>

      <div className="flex flex-col items-end justify-between">
        <button
          type="button"
          onClick={() => onRemove(line.cartLineId)}
          aria-label="Xoá món"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChangeQuantity(line.cartLineId, line.quantity - 1)}
            aria-label="Giảm số lượng"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChangeQuantity(line.cartLineId, line.quantity + 1)}
            aria-label="Tăng số lượng"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
