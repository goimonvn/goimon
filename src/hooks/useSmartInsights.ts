"use client";

import { getSmartInsights } from "@/services/analytics.service";
import { subscribeToAnyOrderUpdate, subscribeToOrderItemUpdates } from "@/services/order.service";
import type { SmartInsight } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseSmartInsightsResult {
  insights: SmartInsight[];
  loading: boolean;
}

/** Nhận định thông minh (Module 10) ở trang chủ Admin Dashboard — luôn so sánh tuần này với tuần trước, tự làm mới khi có đơn/món mới. */
export function useSmartInsights(): UseSmartInsightsResult {
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getSmartInsights();
        if (!cancelled) setInsights(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải nhận định thông minh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channels = [subscribeToAnyOrderUpdate(() => void load()), subscribeToOrderItemUpdates(() => void load())];

    return () => {
      cancelled = true;
      channels.forEach((channel) => void channel.unsubscribe());
    };
  }, []);

  return { insights, loading };
}
