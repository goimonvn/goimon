"use client";

import { getActiveShiftForCurrentStaff } from "@/services/shift.service";
import type { ShiftsRow } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseActiveShiftResult {
  activeShift: ShiftsRow | null;
  loading: boolean;
  /** Gọi sau khi Bắt đầu ca/Kết thúc ca thành công để cập nhật lại widget ngay lập tức. */
  refetch: () => void;
}

/**
 * Ca làm việc đang mở (nếu có) của nhân viên hiện đăng nhập — dùng cho widget
 * `ShiftControl` gắn ở `StaffNav` (hiển thị trên mọi trang `/staff/*`).
 * Không cần realtime riêng: chỉ đổi khi CHÍNH nhân viên này bấm nút, nên chỉ
 * cần refetch chủ động sau mỗi thao tác thay vì lắng nghe postgres_changes.
 */
export function useActiveShift(): UseActiveShiftResult {
  const [activeShift, setActiveShift] = useState<ShiftsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveShiftForCurrentStaff();
        if (!cancelled) setActiveShift(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể kiểm tra ca làm việc hiện tại.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { activeShift, loading, refetch };
}
