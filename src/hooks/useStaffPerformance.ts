"use client";

import { subscribeToAnyOrderUpdate } from "@/services/order.service";
import { getStaffPerformance, subscribeToShiftChanges } from "@/services/shift.service";
import type { AnalyticsDateRange, StaffPerformanceRow } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseStaffPerformanceResult {
  rows: StaffPerformanceRow[];
  loading: boolean;
}

/**
 * So sánh hiệu suất nhân viên (Module 21) cho `/admin/staff-performance` — tự
 * tải lại khi đổi khoảng thời gian lọc, hoặc khi có ca/đơn hàng thay đổi (2
 * nguồn dữ liệu gốc của `getStaffPerformance`). So sánh `range` theo GIÁ TRỊ
 * (`getTime()`) trong dependency array — cùng lý do đã ghi ở
 * `useAnalyticsReport.ts` (trang gọi `resolveAnalyticsRange` mỗi lần render
 * ra 1 object `Date` mới).
 */
export function useStaffPerformance(range: AnalyticsDateRange): UseStaffPerformanceResult {
  const [rows, setRows] = useState<StaffPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fromTime = range.from.getTime();
  const toTime = range.to.getTime();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getStaffPerformance({ from: new Date(fromTime), to: new Date(toTime) });
        if (!cancelled) setRows(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải dữ liệu hiệu suất nhân viên.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channels = [subscribeToShiftChanges(() => void load()), subscribeToAnyOrderUpdate(() => void load())];

    return () => {
      cancelled = true;
      channels.forEach((channel) => void channel.unsubscribe());
    };
  }, [fromTime, toTime]);

  return { rows, loading };
}
