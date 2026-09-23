"use client";

import {
  getAllActiveOrders,
  subscribeToAnyOrderUpdate,
  subscribeToOrderItemUpdates,
} from "@/services/order.service";
import { getPendingStaffCalls, subscribeToStaffCalls } from "@/services/staffCall.service";
import { getAllTables, subscribeToTableChanges } from "@/services/table.service";
import type { TableWithOrders } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseTablesResult {
  tables: TableWithOrders[];
  loading: boolean;
}

/**
 * Lưới quản lý bàn của nhân viên: gộp danh sách bàn + đơn đang hoạt động +
 * yêu cầu hỗ trợ đang chờ, tự làm mới khi có realtime event ở bất kỳ bảng
 * liên quan nào (tables/orders/order_items/staff_calls).
 */
export function useTables(): UseTablesResult {
  const [tables, setTables] = useState<TableWithOrders[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [tableRows, orders, staffCalls] = await Promise.all([
          getAllTables(),
          getAllActiveOrders(),
          getPendingStaffCalls(),
        ]);
        if (cancelled) return;

        const merged: TableWithOrders[] = tableRows.map((table) => ({
          ...table,
          activeOrders: orders.filter((order) => order.table_id === table.id),
          pendingStaffCalls: staffCalls.filter((call) => call.table_id === table.id),
        }));
        setTables(merged);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách bàn.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channels = [
      subscribeToTableChanges(() => void load()),
      subscribeToAnyOrderUpdate(() => void load()),
      subscribeToOrderItemUpdates(() => void load()),
      subscribeToStaffCalls(() => void load()),
    ];

    return () => {
      cancelled = true;
      channels.forEach((channel) => void channel.unsubscribe());
    };
  }, []);

  return { tables, loading };
}
