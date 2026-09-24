"use client";

import { getShiftHistory, subscribeToShiftChanges } from "@/services/shift.service";
import type { ShiftWithStaff } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseShiftHistoryResult {
  shifts: ShiftWithStaff[];
  loading: boolean;
  /** Module 14: gọi tay sau khi admin đóng ca hộ/sửa số liệu, để bảng cập nhật ngay thay vì đợi sự kiện realtime. */
  refetch: () => void;
}

/** Lịch sử ca làm việc toàn quán — tự làm mới ngay khi có ca mới mở/đóng (realtime), dùng cho /admin/shifts. */
export function useShiftHistory(): UseShiftHistoryResult {
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getShiftHistory();
        if (!cancelled) setShifts(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải lịch sử ca làm việc.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToShiftChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { shifts, loading, refetch };
}
