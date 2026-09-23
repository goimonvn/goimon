"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { STATION_TYPE_LABEL, type MenuItemWithOptions } from "@/types";
import { Pencil, Trash2 } from "lucide-react";

interface AdminMenuItemRowProps {
  item: MenuItemWithOptions;
  onEdit: () => void;
  onDelete: () => void;
}

/** Một dòng món trong trang quản lý menu của chủ quán — khác MenuAvailabilityRow (Module 2, chỉ bật/tắt còn hàng): ở đây có đủ sửa/xoá. */
export function AdminMenuItemRow({ item, onEdit, onDelete }: AdminMenuItemRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <Badge variant={item.is_available ? "success" : "secondary"} className="shrink-0">
            {item.is_available ? "Còn hàng" : "Hết món"}
          </Badge>
          <Badge variant="outline" className="shrink-0">
            {STATION_TYPE_LABEL[item.station_type]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(item.price)}
          {item.options.length > 0 && ` · ${item.options.length} option`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
