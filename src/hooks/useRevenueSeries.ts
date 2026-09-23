"use client";

import { getRevenueSeries } from "@/services/analytics.service";
import { subscribeToAnyOrderUpdate } from "@/services/order.service";
import type { RevenuePoint, RevenueRange } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseRevenueSeriesResult {
  points: RevenuePoint[];
  loading: boolean;
}

/** Dữ liệu biểu đồ doanh thu theo khoảng thời gian đã chọn (hôm nay theo giờ, 7 ngày theo ngày). */
export function useRevenueSeries(range: RevenueRange): UseRevenueSeriesResult {
  const [points, setPoints] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getRevenueSeries(range);
        if (!cancelled) setPoints(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải biểu đồ doanh thu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channel = subscribeToAnyOrderUpdate(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [range]);

  return { points, loading };
}
