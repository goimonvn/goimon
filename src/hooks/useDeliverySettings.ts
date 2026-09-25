"use client";

import {
  getDeliverySettings,
  subscribeToDeliverySettingsChanges,
  updateDeliverySettings,
} from "@/services/delivery.service";
import type { DeliveryConfigValue } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseDeliverySettingsResult {
  /** null trong lúc đang tải lần đầu — nơi CHỈ ĐỌC (`/delivery`, `/delivery/cart`) nên coi null như "chưa biết, cứ cho đặt hàng" để không chớp tắt UI, giống `usePaymentSettings`. */
  settings: DeliveryConfigValue | null;
  loading: boolean;
  updating: boolean;
  /** Chỉ dùng ở `/admin/settings` — đổi 1 field rồi lưu cả object (bảng chỉ có 1 dòng JSONB cho key này). */
  updateSetting: <K extends keyof DeliveryConfigValue>(key: K, value: DeliveryConfigValue[K]) => Promise<void>;
}

/** Cấu hình kênh Giao tận nơi (Module 19) — dùng CHUNG ở trang cấu hình của chủ quán (đọc + ghi) và trang khách/nhân viên (CHỈ ĐỌC, tự cập nhật realtime). Cùng khuôn mẫu `usePaymentSettings` (Module 17). */
export function useDeliverySettings(): UseDeliverySettingsResult {
  const [settings, setSettings] = useState<DeliveryConfigValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    getDeliverySettings()
      .then((data) => setSettings(data))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Không thể tải cấu hình giao hàng.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const channel = subscribeToDeliverySettingsChanges(load);
    return () => {
      void channel.unsubscribe();
    };
  }, [load]);

  async function updateSetting<K extends keyof DeliveryConfigValue>(key: K, value: DeliveryConfigValue[K]) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setUpdating(true);
    try {
      await updateDeliverySettings(next);
      setSettings(next);
      toast.success("Đã cập nhật cấu hình giao hàng.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật cấu hình.");
    } finally {
      setUpdating(false);
    }
  }

  return { settings, loading, updating, updateSetting };
}
