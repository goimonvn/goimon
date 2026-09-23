"use client";

import { getLowStockIngredients, subscribeToIngredientChanges } from "@/services/inventory.service";
import type { IngredientsRow } from "@/types/database.types";
import { useEffect, useState } from "react";

interface UseLowStockIngredientsResult {
  lowStockIngredients: IngredientsRow[];
  loading: boolean;
}

/** Danh sách nguyên liệu sắp/đã hết — dùng cho badge cảnh báo trên Dashboard, tự làm mới realtime khi KDS trừ kho. */
export function useLowStockIngredients(): UseLowStockIngredientsResult {
  const [lowStockIngredients, setLowStockIngredients] = useState<IngredientsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getLowStockIngredients();
        if (!cancelled) setLowStockIngredients(data);
      } catch {
        // Badge cảnh báo không quan trọng bằng phần còn lại của Dashboard — bỏ qua lỗi lặng lẽ, không toast chặn trang.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToIngredientChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { lowStockIngredients, loading };
}
