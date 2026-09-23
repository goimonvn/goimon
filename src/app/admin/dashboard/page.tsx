"use client";

import { BestSellerTable } from "@/components/admin/BestSellerTable";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { SmartInsightsCard } from "@/components/admin/SmartInsightsCard";
import { StatCard } from "@/components/admin/StatCard";
import { TableStatusSummaryCard } from "@/components/admin/TableStatusSummaryCard";
import { PaymentConfirmSheet } from "@/components/staff/PaymentConfirmSheet";
import { TableCard } from "@/components/staff/TableCard";
import { TableDetailSheet } from "@/components/staff/TableDetailSheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useLowStockIngredients } from "@/hooks/useLowStockIngredients";
import { useTables } from "@/hooks/useTables";
import { formatCurrency } from "@/lib/utils";
import type { TableWithOrders } from "@/types";
import { AlertTriangle, ClipboardList, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Dashboard tổng quan cho chủ quán: 4 thẻ thống kê hôm nay + lưới 15 bàn
 * realtime (dùng lại nguyên components/hooks của Module 2 — không viết lại
 * logic quản lý bàn) + biểu đồ doanh thu + bảng món bán chạy.
 */
export default function AdminDashboardPage() {
  const { summary, loading: summaryLoading } = useDashboardSummary();
  const { tables, loading: tablesLoading } = useTables();
  const { lowStockIngredients } = useLowStockIngredients();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [paymentTableId, setPaymentTableId] = useState<string | null>(null);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const paymentTable = tables.find((t) => t.id === paymentTableId) ?? null;

  function handlePrintReceipt(table: TableWithOrders) {
    window.open(`/staff/tables/print?table=${table.id}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Tổng quan</h1>
        {lowStockIngredients.length > 0 && (
          <Link href="/admin/inventory">
            <Badge variant="destructive" className="gap-1.5 px-3 py-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowStockIngredients.length} nguyên liệu sắp/đã hết hàng
            </Badge>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Doanh thu hôm nay" value={formatCurrency(summary.revenueToday)} icon={Wallet} />
            <StatCard label="Số đơn hôm nay" value={`${summary.ordersToday}`} icon={ClipboardList} />
            <StatCard
              label="Hoá đơn VAT hôm nay"
              value={`${summary.vatInvoicesToday}`}
              icon={ReceiptText}
            />
            <TableStatusSummaryCard counts={summary.tableStatusCounts} />
          </>
        )}
      </div>

      <SmartInsightsCard />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <BestSellerTable />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Sơ đồ bàn ({tables.length} bàn)</h2>
        {tablesLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {tables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => setSelectedTableId(table.id)} />
            ))}
          </div>
        )}
      </div>

      <TableDetailSheet
        table={selectedTable}
        onOpenChange={(open) => !open && setSelectedTableId(null)}
        onPrintReceipt={handlePrintReceipt}
        onOpenPayment={(table) => {
          setSelectedTableId(null);
          setPaymentTableId(table.id);
        }}
      />

      <PaymentConfirmSheet
        table={paymentTable}
        onOpenChange={(open) => !open && setPaymentTableId(null)}
        onConfirmed={() => setPaymentTableId(null)}
      />
    </div>
  );
}
