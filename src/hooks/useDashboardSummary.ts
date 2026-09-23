"use client";

import { getDashboardSummary } from "@/services/analytics.service";
import { subscribeToAnyOrderUpdate } from "@/services/order.service";
import { subscribeToTableChanges } from "@/services/table.service";
import type { DashboardSummary } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseDashboardSummaryResult {
  summary: DashboardSummary | null;
  loading: boolean;
}

/**
 * Số liệu 4 thẻ thống kê đầu trang Dashboard. Tự tải lại khi có thay đổi ở
 * orders (đơn mới/thanh toán) hoặc tables (đổi trạng thái bàn) — hoá đơn VAT
 * mới không tự đẩy realtime riêng vì nghiệp vụ tạo hoá đơn luôn đi kèm một
 * order, nên refetch theo order là đủ.
 */
export function useDashboardSummary(): UseDashboardSummaryResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getDashboardSummary();
        if (!cancelled) setSummary(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải số liệu tổng quan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channels = [
      subscribeToAnyOrderUpdate(() => void load()),
      subscribeToTableChanges(() => void load()),
    ];

    return () => {
      cancelled = true;
      channels.forEach((channel) => void channel.unsubscribe());
    };
  }, []);

  return { summary, loading };
}
