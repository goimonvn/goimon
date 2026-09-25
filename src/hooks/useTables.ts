"use client";

import {
  getAllActiveOrders,
  subscribeToAnyOrderUpdate,
  subscribeToOrderItemUpdates,
} from "@/services/order.service";
import { getActiveReservations, subscribeToReservationChanges } from "@/services/reservation.service";
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
        const [tableRows, orders, staffCalls, reservations] = await Promise.all([
          getAllTables(),
          getAllActiveOrders(),
          getPendingStaffCalls(),
          getActiveReservations(),
        ]);
        if (cancelled) return;

        // Module 18: chỉ những lượt ĐÃ XÁC NHẬN và ĐÃ GÁN bàn mới hiện badge
        // tham khảo trên sơ đồ — lượt 'pending' (chưa gọi lại xác nhận) hoặc
        // chưa gán bàn cụ thể không hiển thị ở đây, chỉ thấy ở
        // `/staff/reservations`.
        const confirmedByTable = new Map(
          reservations
            .filter((r) => r.status === "confirmed" && r.table_id !== null)
            .map((r) => [r.table_id as string, r])
        );

        const merged: TableWithOrders[] = tableRows.map((table) => ({
          ...table,
          activeOrders: orders.filter((order) => order.table_id === table.id),
          pendingStaffCalls: staffCalls.filter((call) => call.table_id === table.id),
          upcomingReservation: confirmedByTable.get(table.id) ?? null,
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
      subscribeToReservationChanges(() => void load()),
    ];

    return () => {
      cancelled = true;
      channels.forEach((channel) => void channel.unsubscribe());
    };
  }, []);

  return { tables, loading };
}
