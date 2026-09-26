"use client";

import { getSuppliers, subscribeToSupplierChanges } from "@/services/purchasing.service";
import type { SuppliersRow } from "@/types/database.types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseSuppliersResult {
  suppliers: SuppliersRow[];
  loading: boolean;
}

/** Danh sách nhà cung cấp, tự làm mới khi có thêm/sửa/xoá — dùng cho `/admin/purchases`. */
export function useSuppliers(): UseSuppliersResult {
  const [suppliers, setSuppliers] = useState<SuppliersRow[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return { suppliers, loading };
}
