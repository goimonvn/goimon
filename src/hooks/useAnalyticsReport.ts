"use client";

import { getAnalyticsReport } from "@/services/analytics.service";
import { subscribeToAnyOrderUpdate, subscribeToOrderItemUpdates } from "@/services/order.service";
import type { AnalyticsDateRange, AnalyticsReport } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseAnalyticsReportResult {
  report: AnalyticsReport | null;
  loading: boolean;
}

/**
 * Báo cáo phân tích chi tiết cho `/admin/analytics` — tự tải lại khi đổi
 * khoảng thời gian lọc hoặc khi có đơn/món mới. So sánh `range` theo GIÁ TRỊ
 * (`getTime()`) trong dependency array vì trang gọi `resolveAnalyticsRange`
 * mỗi lần render ra 1 object `Date` mới — so sánh tham chiếu trực tiếp sẽ
 * khiến effect chạy lại vô tận.
 */
export function useAnalyticsReport(range: AnalyticsDateRange): UseAnalyticsReportResult {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const fromTime = range.from.getTime();
  const toTime = range.to.getTime();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getAnalyticsReport({ from: new Date(fromTime), to: new Date(toTime) });
        if (!cancelled) setReport(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải báo cáo phân tích.");
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
  }, [fromTime, toTime]);

  return { report, loading };
}
