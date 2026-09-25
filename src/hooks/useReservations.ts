"use client";

import { getActiveReservations, subscribeToReservationChanges } from "@/services/reservation.service";
import type { ReservationWithTable } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseReservationsResult {
  reservations: ReservationWithTable[];
  loading: boolean;
}

/** Danh sách lượt đặt bàn CHƯA kết thúc ('pending' + 'confirmed'), tự làm mới realtime — dùng cho `/staff/reservations`. */
export function useReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<ReservationWithTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveReservations();
        if (!cancelled) setReservations(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách đặt bàn.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToReservationChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { reservations, loading };
}
