"use client";

import { getPendingStaffCalls, subscribeToStaffCalls } from "@/services/staffCall.service";
import type { StaffCallWithTable } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseStaffCallsResult {
  calls: StaffCallWithTable[];
  loading: boolean;
}

/** Danh sách yêu cầu hỗ trợ đang chờ xử lý (gọi nhân viên/xin đá/thanh toán), tự làm mới realtime. */
export function useStaffCalls(): UseStaffCallsResult {
  const [calls, setCalls] = useState<StaffCallWithTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getPendingStaffCalls();
        if (!cancelled) setCalls(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải yêu cầu hỗ trợ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToStaffCalls(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { calls, loading };
}
