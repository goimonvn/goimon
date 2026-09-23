"use client";

import { notifyCustomer } from "@/lib/notify";
import {
  getActiveOrdersByTable,
  subscribeToOrderItemUpdates,
  subscribeToOrderUpdates,
} from "@/services/order.service";
import type { OrderWithItems } from "@/types";
import type { OrderItemStatus } from "@/types/database.types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseActiveOrdersResult {
  orders: OrderWithItems[];
  loading: boolean;
  refetch: () => void;
}

/**
 * Tải các đơn đang hoạt động của bàn + tự làm mới khi có realtime event trên
 * order_items (đổi item_status) hoặc orders (đổi status/payment_status).
 * Cách đơn giản và chắc chắn nhất là refetch toàn bộ khi có event, vì khối
 * lượng dữ liệu 1 bàn rất nhỏ (không đáng lo về hiệu năng).
 *
 * Module 7: mỗi lần refetch, so sánh trạng thái từng món với lần tải TRƯỚC ĐÓ
 * (lưu ở `previousStatusRef`, không phải state — không cần re-render vì chỉ
 * dùng để so sánh) để phát hiện món VỪA chuyển sang "ready" ("Đã xong") và
 * rung nhẹ + toast ngay cho khách, dù khách đang xem trang khác trên điện
 * thoại. Bỏ qua lần tải ĐẦU TIÊN (ref còn null) để không báo nhầm cho các
 * món vốn đã "Đã xong" từ trước khi khách mở/tải lại trang.
 */
export function useActiveOrders(tableId: string | null): UseActiveOrdersResult {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const previousStatusRef = useRef<Map<string, OrderItemStatus> | null>(null);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    if (!tableId) {
      setOrders([]);
      setLoading(false);
      previousStatusRef.current = null;
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await getActiveOrdersByTable(tableId as string);
        if (cancelled) return;

        const previousStatus = previousStatusRef.current;
        if (previousStatus) {
          const newlyReadyItems = data
            .flatMap((order) => order.order_items)
            .filter((item) => item.item_status === "ready" && previousStatus.get(item.id) !== "ready");

          if (newlyReadyItems.length > 0) {
            notifyCustomer();
            newlyReadyItems.forEach((item) => {
              toast.success(`Món "${item.menu_item?.name ?? "của bạn"}" đã sẵn sàng!`);
            });
          }
        }

        previousStatusRef.current = new Map(
          data.flatMap((order) => order.order_items.map((item) => [item.id, item.item_status] as const))
        );

        setOrders(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không thể tải trạng thái đơn hàng.";
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const itemsChannel = subscribeToOrderItemUpdates(() => void load());
    const orderChannel = subscribeToOrderUpdates(tableId, () => void load());

    return () => {
      cancelled = true;
      void itemsChannel.unsubscribe();
      void orderChannel.unsubscribe();
    };
  }, [tableId, reloadToken]);

  return { orders, loading, refetch };
}
