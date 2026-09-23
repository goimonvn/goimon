"use client";

import { getAllVatInvoices } from "@/services/vatInvoice.service";
import type { VatInvoiceWithOrder } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseVatInvoicesResult {
  invoices: VatInvoiceWithOrder[];
  loading: boolean;
  refetch: () => void;
}

/** Danh sách hoá đơn VAT đã xuất — trang này không có realtime riêng (hoá đơn tạo 1 lần lúc thanh toán), refetch tay là đủ. */
export function useVatInvoices(): UseVatInvoicesResult {
  const [invoices, setInvoices] = useState<VatInvoiceWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getAllVatInvoices();
        if (!cancelled) setInvoices(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách hoá đơn VAT.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { invoices, loading, refetch };
}
