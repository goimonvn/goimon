"use client";

import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import { setMenuItemAvailability } from "@/services/menu.service";
import type { MenuItemWithOptions } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface MenuAvailabilityRowProps {
  item: MenuItemWithOptions;
}

/** Một dòng bật/tắt "Hết món" — cập nhật lạc quan (optimistic) rồi đồng bộ với server. */
export function MenuAvailabilityRow({ item }: MenuAvailabilityRowProps) {
  const [isAvailable, setIsAvailable] = useState(item.is_available);
  const [saving, setSaving] = useState(false);

  async function handleToggle(next: boolean) {
    setIsAvailable(next);
    setSaving(true);
    try {
      await setMenuItemAvailability(item.id, next);
      toast.success(next ? `${item.name} đã mở bán lại.` : `${item.name} đã được đánh dấu hết món.`);
    } catch (error) {
      setIsAvailable(!next); // rollback nếu lỗi
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái món.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">{isAvailable ? "Còn hàng" : "Hết món"}</span>
        <Switch checked={isAvailable} disabled={saving} onCheckedChange={handleToggle} />
      </div>
    </div>
  );
}
