"use client";

import { getShopSettings, setBlockWhenInsufficientStock } from "@/services/inventory.service";
import type { ShopSettingsRow } from "@/types/database.types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseShopSettingsResult {
  settings: ShopSettingsRow | null;
  loading: boolean;
  updating: boolean;
  toggleBlockWhenInsufficientStock: (value: boolean) => Promise<void>;
}

/** Cấu hình quán (hiện chỉ có 1 tuỳ chọn: chặn/không chặn khi thiếu nguyên liệu) — singleton row `shop_settings`. */
export function useShopSettings(): UseShopSettingsResult {
  const [settings, setSettings] = useState<ShopSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShopSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Không thể tải cấu hình quán.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleBlockWhenInsufficientStock(value: boolean) {
    setUpdating(true);
    try {
      await setBlockWhenInsufficientStock(value);
      setSettings((prev) => (prev ? { ...prev, block_order_when_insufficient_stock: value } : prev));
      toast.success(value ? "Đã bật chặn khi thiếu nguyên liệu." : "Đã tắt chặn khi thiếu nguyên liệu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật cấu hình.");
    } finally {
      setUpdating(false);
    }
  }

  return { settings, loading, updating, toggleBlockWhenInsufficientStock };
}
