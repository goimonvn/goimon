"use client";

import { subscribeToIngredientChanges } from "@/services/inventory.service";
import { subscribeToMenuItemChanges } from "@/services/menu.service";
import { getMenuItemMargins } from "@/services/purchasing.service";
import type { MenuItemMargin } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseMenuItemMarginsResult {
  margins: MenuItemMargin[];
  loading: boolean;
  refetch: () => void;
}

/**
 * Giá vốn/biên lợi nhuận theo món (Module 20) — tự làm mới khi có nhập hàng
 * mới (avg_cost đổi, qua subscribeToIngredientChanges) hoặc đổi giá bán (qua
 * subscribeToMenuItemChanges). KHÔNG tự làm mới khi công thức món
 * (recipe_items) đổi — dự án chưa có kênh realtime riêng cho bảng này (số
 * lần admin sửa công thức rất hiếm) — dùng nút "Làm mới" (refetch) sau khi
 * sửa công thức ở RecipeEditor.
 */
export function useMenuItemMargins(): UseMenuItemMarginsResult {
  const [margins, setMargins] = useState<MenuItemMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getMenuItemMargins();
        if (!cancelled) setMargins(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tính giá vốn/biên lợi nhuận theo món.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const ingredientChannel = subscribeToIngredientChanges(() => void load());
    const menuItemChannel = subscribeToMenuItemChanges(() => void load());

    return () => {
      cancelled = true;
      void ingredientChannel.unsubscribe();
      void menuItemChannel.unsubscribe();
    };
  }, [reloadToken]);

  return { margins, loading, refetch };
}
