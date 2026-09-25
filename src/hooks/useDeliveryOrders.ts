"use client";

import { getActiveDeliveryOrders, subscribeToDeliveryOrderChanges } from "@/services/delivery.service";
import type { OrderWithItems } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseDeliveryOrdersResult {
  orders: OrderWithItems[];
  loading: boolean;
}

/** Danh sách đơn giao hàng CHƯA kết thúc, tự làm mới realtime — dùng cho `/staff/orders` (Module 19). */
export function useDeliveryOrders(): UseDeliveryOrdersResult {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveDeliveryOrders();
        if (!cancelled) setOrders(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách đơn giao hàng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToDeliveryOrderChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { orders, loading };
}
