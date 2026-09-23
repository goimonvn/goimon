"use client";

import { getBestSellers } from "@/services/analytics.service";
import { subscribeToOrderItemUpdates } from "@/services/order.service";
import type { BestSellerRow } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseBestSellersResult {
  rows: BestSellerRow[];
  loading: boolean;
}

/** Bảng xếp hạng món bán chạy — tự làm mới khi có order_item mới (đặt món mới ở bất kỳ bàn nào). */
export function useBestSellers(limit = 10): UseBestSellersResult {
  const [rows, setRows] = useState<BestSellerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getBestSellers(limit);
        if (!cancelled) setRows(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải bảng xếp hạng món bán chạy.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channel = subscribeToOrderItemUpdates(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [limit]);

  return { rows, loading };
}
