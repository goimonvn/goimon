"use client";

import { getStationQueue, subscribeToOrderItemUpdates } from "@/services/order.service";
import type { KdsTicket } from "@/types";
import type { StationType } from "@/types/database.types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseStationQueueResult {
  tickets: KdsTicket[];
  loading: boolean;
}

/** Hàng đợi món của một trạm (bar/bếp), tự làm mới realtime khi order_items thay đổi. */
export function useStationQueue(station: StationType): UseStationQueueResult {
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getStationQueue(station);
        if (!cancelled) setTickets(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải hàng đợi món.");
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
  }, [station]);

  return { tickets, loading };
}
