"use client";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { TABLE_STATUS_LABEL, type TableWithOrders } from "@/types";
import { Bell, Smartphone } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

interface TableCardProps {
  table: TableWithOrders;
  onClick: () => void;
  /**
   * "Gọi món hộ" (Module 12) — CHỈ hiển thị khi cha truyền prop này (staff/tables),
   * KHÔNG hiển thị ở lưới bàn thu gọn trên /admin/dashboard (cha không truyền)
   * để không làm rối 1 màn hình vốn chỉ để xem tổng quan.
   */
  onOrderForCustomer?: (table: TableWithOrders) => void;
}

const STATUS_STYLE: Record<TableWithOrders["status"], string> = {
  empty: "border-border bg-card",
  ordering: "border-amber-400 bg-amber-50",
  paid: "border-primary bg-primary/10",
};

/**
 * Cả thẻ là 1 vùng bấm được (mở chi tiết bàn) — dùng `div role="button"` thay
 * vì thẻ `<button>` gốc trước đây (Module 12) vì nút "Gọi món hộ" bên trong
 * CŨNG là 1 `<button>` thật: HTML không cho phép lồng `<button>` trong
 * `<button>` (trình duyệt sẽ tự "thoát" ra ngoài, phá vỡ layout/sự kiện click).
 * `role="button"` + `tabIndex`/`onKeyDown` giữ nguyên khả năng thao tác bằng
 * bàn phím mà thẻ `<button>` gốc vốn có sẵn.
 */
export function TableCard({ table, onClick, onOrderForCustomer }: TableCardProps) {
  const total = table.activeOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const itemCount = table.activeOrders.reduce(
    (sum, order) => sum + order.order_items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const hasPendingCall = table.pendingStaffCalls.length > 0;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  function handleOrderForCustomerClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onOrderForCustomer?.(table);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
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
      {onOrderForCustomer && (
        <button
          type="button"
          onClick={handleOrderForCustomerClick}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border bg-background py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Gọi món hộ
        </button>
      )}
    </div>
  );
}
