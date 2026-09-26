"use client";

import { StatCard } from "@/components/admin/StatCard";
import { VatInvoiceDetailDialog } from "@/components/admin/VatInvoiceDetailDialog";
import { VatInvoiceTable } from "@/components/admin/VatInvoiceTable";
import { useVatInvoices } from "@/hooks/useVatInvoices";
import { usePageTitle } from "@/hooks/usePageTitle";
import { estimateVatAmount, formatCurrency } from "@/lib/utils";
import type { VatInvoiceWithOrder } from "@/types";
import { FileText, Receipt } from "lucide-react";
import { useState } from "react";

/** Trang danh sách hoá đơn VAT — xem tổng quan số hoá đơn + tổng tiền VAT (tạm tính), bấm 1 dòng để xem chi tiết công ty. */
export default function AdminVatInvoicesPage() {
  usePageTitle("Hoá đơn VAT");
  const { invoices, loading } = useVatInvoices();
  const [selected, setSelected] = useState<VatInvoiceWithOrder | null>(null);

  const totalVat = invoices.reduce(
    (sum, invoice) => sum + estimateVatAmount(invoice.order?.total_amount ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Hoá đơn VAT</h1>
        <p className="text-sm text-muted-foreground">Danh sách yêu cầu xuất hoá đơn VAT từ khách hàng.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:w-1/2">
        <StatCard label="Số hoá đơn đã xuất" value={`${invoices.length}`} icon={FileText} />
        <StatCard label="Tổng tiền VAT (tạm tính)" value={formatCurrency(totalVat)} icon={Receipt} />
      </div>

      <VatInvoiceTable invoices={invoices} loading={loading} onSelect={setSelected} />

      <VatInvoiceDetailDialog invoice={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
