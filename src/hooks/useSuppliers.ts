"use client";

import { getSuppliers, subscribeToSupplierChanges } from "@/services/purchasing.service";
import type { SuppliersRow } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseSuppliersResult {
  suppliers: SuppliersRow[];
  loading: boolean;
  refetch: () => void;
}

/**
 * Danh sách nhà cung cấp, tự làm mới khi có thêm/sửa/xoá.
 *
 * Trước đây CHỈ dựa vào Realtime (`subscribeToSupplierChanges`) để tự làm
 * mới, không có `refetch` — khác `usePurchaseReceipts`/`useIngredients` vốn
 * đều có thêm cơ chế `reloadToken`/`refetch` làm đường DỰ PHÒNG. Vì bảng
 * `suppliers` (Module 20) chưa từng được xác nhận đã bật Realtime trên
 * Supabase thật (xem `tinh-trang-du-an.md` mục 8/23), `/admin/purchases`
 * thêm nhà cung cấp xong không tự hiện tên mới cho tới khi F5 lại trang.
 * Đã sửa: thêm ĐÚNG `reloadToken`/`refetch` theo khuôn mẫu
 * `usePurchaseReceipts.ts`, để `SupplierFormDialog.onSaved` gọi thẳng
 * `refetch()` sau khi lưu — không còn phụ thuộc DUY NHẤT vào Realtime.
 */
export function useSuppliers(): UseSuppliersResult {
  const [suppliers, setSuppliers] = useState<SuppliersRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getSuppliers();
        if (!cancelled) setSuppliers(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách nhà cung cấp.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToSupplierChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken]);

  return { suppliers, loading, refetch };
}
