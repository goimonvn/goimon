"use client";

import { getExpenses, subscribeToExpenseChanges } from "@/services/expense.service";
import type { ExpenseFilters, ExpenseWithCreator } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseExpensesResult {
  expenses: ExpenseWithCreator[];
  loading: boolean;
  refetch: () => void;
}

/** Danh sách chi phí theo bộ lọc hiện tại (Module 12) — tự làm mới realtime khi có khoản chi mới/bị xoá ở nơi khác (vd 2 tab admin cùng mở). */
export function useExpenses(filters: ExpenseFilters): UseExpensesResult {
  const [expenses, setExpenses] = useState<ExpenseWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getExpenses({
          category: filters.category,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });
        if (!cancelled) setExpenses(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách chi phí.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToExpenseChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
    // Dùng từng trường nguyên thuỷ của `filters` làm dependency (không phải cả
    // object `filters`) — cha truyền vào 1 object literal mới mỗi lần render
    // sẽ khiến effect chạy lại vô hạn nếu dùng thẳng `filters` làm dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.fromDate, filters.toDate, reloadToken, refetch]);

  return { expenses, loading, refetch };
}
