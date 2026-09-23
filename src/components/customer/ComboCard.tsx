"use client";

import { formatCurrency } from "@/lib/utils";
import type { ComboWithItems } from "@/types";
import Image from "next/image";

interface ComboCardProps {
  combo: ComboWithItems;
  onSelect: (combo: ComboWithItems) => void;
}

/** Thẻ combo trong mục "Combo Tiết Kiệm" — cùng bố cục với MenuItemCard để đồng bộ giao diện, nhưng luôn bấm được (combo không có khái niệm "hết món riêng lẻ"). */
export function ComboCard({ combo, onSelect }: ComboCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(combo)}
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-primary/30 bg-card text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full bg-muted">
        {combo.image_url ? (
          <Image
            src={combo.image_url}
            alt={combo.name}
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">🎁</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
          Combo
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{combo.name}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {combo.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ")}
        </span>
        <span className="mt-auto text-sm font-semibold text-primary">{formatCurrency(combo.price)}</span>
      </div>
    </button>
  );
}
