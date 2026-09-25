"use client";

import {
  getPaymentSettings,
  subscribeToPaymentSettingsChanges,
  updatePaymentSettings,
} from "@/services/settings.service";
import type { PaymentConfigValue } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UsePaymentSettingsResult {
  /** null trong lúc đang tải lần đầu — nơi CHỈ ĐỌC (CheckoutSheet/PaymentConfirmSheet/TableDetailSheet) nên coi null như "chưa biết, cứ hiện đủ" để không chớp tắt UI. */
  settings: PaymentConfigValue | null;
  loading: boolean;
  /** true khi đang lưu 1 thay đổi — chỉ trang /admin/settings dùng để disable Switch trong lúc chờ. */
  updating: boolean;
  /** Chỉ dùng ở `/admin/settings` — đổi đúng 1 cờ rồi lưu cả object (bảng chỉ có 1 dòng JSONB). */
  updateSetting: (key: keyof PaymentConfigValue, value: boolean) => Promise<void>;
}

/**
 * Cấu hình bật/tắt phương thức thanh toán (Module 17) — dùng CHUNG ở cả 3 nơi:
 * trang cấu hình của chủ quán (đọc + ghi), và màn thanh toán của khách/nhân
 * viên (CHỈ ĐỌC, tự cập nhật realtime khi admin đổi cấu hình ở nơi khác).
 */
export function usePaymentSettings(): UsePaymentSettingsResult {
  const [settings, setSettings] = useState<PaymentConfigValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    getPaymentSettings()
      .then((data) => setSettings(data))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Không thể tải cấu hình thanh toán.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const channel = subscribeToPaymentSettingsChanges(load);
    return () => {
      void channel.unsubscribe();
    };
  }, [load]);

  async function updateSetting(key: keyof PaymentConfigValue, value: boolean) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setUpdating(true);
    try {
      await updatePaymentSettings(next);
      setSettings(next);
      toast.success("Đã cập nhật cấu hình thanh toán.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật cấu hình.");
    } finally {
      setUpdating(false);
    }
  }

  return { settings, loading, updating, updateSetting };
}
