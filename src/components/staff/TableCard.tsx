"use client";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { TABLE_STATUS_LABEL, type TableWithOrders } from "@/types";
import { Bell } from "lucide-react";

interface TableCardProps {
  table: TableWithOrders;
  onClick: () => void;
}

const STATUS_STYLE: Record<TableWithOrders["status"], string> = {
  empty: "border-border bg-card",
  ordering: "border-amber-400 bg-amber-50",
  paid: "border-primary bg-primary/10",
};

export function TableCard({ table, onClick }: TableCardProps) {
  const total = table.activeOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const itemCount = table.activeOrders.reduce(
    (sum, order) => sum + order.order_items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const hasPendingCall = table.pendingStaffCalls.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-transform active:scale-[0.97]",
        STATUS_STYLE[table.status]
      )}
    >
      {hasPendingCall && (
        <span className="absolute -right-2 -top-2 flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
          <Bell className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="text-2xl font-bold">Bàn {table.table_number}</span>
      <Badge
        variant={table.status === "empty" ? "outline" : table.status === "ordering" ? "warning" : "success"}
      >
        {TABLE_STATUS_LABEL[table.status]}
      </Badge>
      {table.activeOrders.length > 0 && (
        <div className="mt-1 text-sm text-muted-foreground">
          {itemCount} món · <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
        </div>
      )}
      {hasPendingCall && (
        <p className="text-xs font-medium text-destructive">
          {table.pendingStaffCalls.length} yêu cầu đang chờ
        </p>
      )}
    </button>
  );
}
