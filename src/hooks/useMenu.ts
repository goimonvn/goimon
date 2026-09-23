"use client";

import { getMenu, subscribeToMenuItemChanges } from "@/services/menu.service";
import type { CategoryWithItems } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseMenuResult {
  categories: CategoryWithItems[];
  loading: boolean;
  /** Tải lại toàn bộ menu — dùng sau khi trang quản trị (Module 3) thêm/sửa/xoá danh mục, món hoặc option. */
  refetch: () => void;
}

/** Tải menu + tự cập nhật is_available/giá theo realtime khi bếp/chủ quán đổi trên menu_items. */
export function useMenu(): UseMenuResult {
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getMenu();
        if (!cancelled) setCategories(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể tải thực đơn.";
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channel = subscribeToMenuItemChanges((updatedItem) => {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === updatedItem.category_id
            ? {
                ...category,
                items: category.items.map((item) =>
                  item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                ),
              }
            : category
        )
      );
    });

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken]);

  return { categories, loading, refetch };
}
