"use client";

import { PaymentConfirmSheet } from "@/components/staff/PaymentConfirmSheet";
import { TableCard } from "@/components/staff/TableCard";
import { TableDetailSheet } from "@/components/staff/TableDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useTables } from "@/hooks/useTables";
import type { TableWithOrders } from "@/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StaffTablesPage() {
  const { tables, loading } = useTables();
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [paymentTableId, setPaymentTableId] = useState<string | null>(null);

  // Luôn lấy bản mới nhất từ danh sách (thay vì giữ snapshot cũ) để sheet tự
  // cập nhật realtime theo dữ liệu mà useTables vừa refetch.
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const paymentTable = tables.find((t) => t.id === paymentTableId) ?? null;

  function handlePrintReceipt(table: TableWithOrders) {
    window.open(`/staff/tables/print?table=${table.id}`, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Quản lý bàn ({tables.length} bàn)</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} onClick={() => setSelectedTableId(table.id)} />
        ))}
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
