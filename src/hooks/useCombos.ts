"use client";

import { getActiveCombosWithItems, subscribeToComboChanges } from "@/services/combo.service";
import type { ComboWithItems } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseCombosResult {
  combos: ComboWithItems[];
  loading: boolean;
}

/** Danh sách combo ĐANG hiển thị cho mục "Combo Tiết Kiệm" trên thực đơn của khách — tự cập nhật realtime khi chủ quán bật/tắt/sửa combo (Module 11). */
export function useCombos(): UseCombosResult {
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveCombosWithItems();
        if (!cancelled) setCombos(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách combo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToComboChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { combos, loading };
}
