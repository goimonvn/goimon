"use client";

import { getPurchaseReceipts, subscribeToPurchaseReceiptChanges } from "@/services/purchasing.service";
import type { PurchaseReceiptWithSupplier } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UsePurchaseReceiptsResult {
  receipts: PurchaseReceiptWithSupplier[];
  loading: boolean;
  refetch: () => void;
}

/** Danh sách phiếu nhập hàng, tự làm mới khi có phiếu mới (KHÔNG có sửa/xoá — sổ sách bất biến, xem purchasing.service.ts) — dùng cho `/admin/purchases`. */
export function usePurchaseReceipts(): UsePurchaseReceiptsResult {
  const [receipts, setReceipts] = useState<PurchaseReceiptWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getPurchaseReceipts();
        if (!cancelled) setReceipts(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách phiếu nhập hàng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToPurchaseReceiptChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken]);

  return { receipts, loading, refetch };
}
