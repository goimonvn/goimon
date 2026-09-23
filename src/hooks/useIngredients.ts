"use client";

import { getAllIngredients, subscribeToIngredientChanges } from "@/services/inventory.service";
import type { IngredientsRow } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseIngredientsResult {
  ingredients: IngredientsRow[];
  loading: boolean;
  refetch: () => void;
}

/** Danh sách nguyên liệu trong kho — tự làm mới khi có trừ/nhập kho ở nơi khác (KDS trừ kho, nhân viên khác nhập hàng). */
export function useIngredients(): UseIngredientsResult {
  const [ingredients, setIngredients] = useState<IngredientsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAllIngredients();
        if (!cancelled) setIngredients(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách nguyên liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToIngredientChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { ingredients, loading, refetch };
}
