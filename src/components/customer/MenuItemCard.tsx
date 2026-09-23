"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { MenuItemWithOptions } from "@/types";
import Image from "next/image";

interface MenuItemCardProps {
  item: MenuItemWithOptions;
  onSelect: (item: MenuItemWithOptions) => void;
}

/** Thẻ món trong lưới menu. Món hết hàng vẫn hiển thị (mờ đi) kèm badge "Hết món". */
export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  return (
    <button
      type="button"
      disabled={!item.is_available}
      onClick={() => onSelect(item)}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-transform active:scale-[0.98] disabled:active:scale-100"
    >
      <div className="relative aspect-square w-full bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className={`object-cover ${item.is_available ? "" : "grayscale"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
            ☕
          </div>
        )}
        {!item.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Badge variant="destructive">Hết món</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</span>
        <span className="mt-auto text-sm font-semibold text-primary">
          {formatCurrency(item.price)}
        </span>
      </div>
    </button>
  );
}
