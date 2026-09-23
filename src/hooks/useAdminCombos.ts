"use client";

import { getAllCombosWithItems, subscribeToComboChanges } from "@/services/combo.service";
import type { ComboWithItems } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseAdminCombosResult {
  combos: ComboWithItems[];
  loading: boolean;
  refetch: () => void;
}

/** Toàn bộ combo (kể cả đã tắt), tự làm mới realtime — dùng cho /admin/combos. */
export function useAdminCombos(): UseAdminCombosResult {
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAllCombosWithItems();
        if (!cancelled) setCombos(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách combo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToComboChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { combos, loading, refetch };
}
