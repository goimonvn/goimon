"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { estimateVatAmount, formatCurrency } from "@/lib/utils";
import type { VatInvoiceWithOrder } from "@/types";

interface VatInvoiceTableProps {
  invoices: VatInvoiceWithOrder[];
  loading: boolean;
  onSelect: (invoice: VatInvoiceWithOrder) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Danh sách hoá đơn VAT đã xuất — mới nhất trước. Bấm 1 dòng để xem chi tiết đầy đủ. */
export function VatInvoiceTable({ invoices, loading, onSelect }: VatInvoiceTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có hoá đơn VAT nào được xuất.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Ngày</th>
            <th className="px-4 py-3 font-medium">Công ty</th>
            <th className="px-4 py-3 font-medium">Mã số thuế</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Bàn</th>
            <th className="px-4 py-3 text-right font-medium">Tổng tiền</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Tiền VAT (tạm tính)</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              onClick={() => onSelect(invoice)}
              className="cursor-pointer border-t transition-colors hover:bg-accent"
            >
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(invoice.created_at)}</td>
              <td className="px-4 py-3 font-medium">{invoice.company_name}</td>
              <td className="px-4 py-3 tabular-nums">{invoice.tax_code}</td>
              <td className="hidden px-4 py-3 sm:table-cell">
                {invoice.order?.table_number != null ? `Bàn ${invoice.order.table_number}` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatCurrency(invoice.order?.total_amount ?? 0)}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-primary md:table-cell">
                {formatCurrency(invoice.order ? estimateVatAmount(invoice.order.total_amount) : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
