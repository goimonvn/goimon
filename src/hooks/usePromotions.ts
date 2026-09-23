"use client";

import { getAllPromotions, subscribeToPromotionChanges } from "@/services/promotion.service";
import type { PromotionsRow } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UsePromotionsResult {
  promotions: PromotionsRow[];
  loading: boolean;
  refetch: () => void;
}

/** Danh sách khuyến mãi (kể cả đã tắt/hết hạn) — tự làm mới ngay khi có khách áp dụng mã (times_used đổi), dùng cho /admin/promotions. */
export function usePromotions(): UsePromotionsResult {
  const [promotions, setPromotions] = useState<PromotionsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAllPromotions();
        if (!cancelled) setPromotions(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách khuyến mãi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToPromotionChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { promotions, loading, refetch };
}
