"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { TABLE_STATUS_LABEL, type TableWithOrders } from "@/types";
import { Bell, Circle, RectangleHorizontal, Smartphone, Sparkles, Square } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

interface TableListRowProps {
  table: TableWithOrders;
  /** Tên khu vực để hiển thị bên cạnh số bàn — null nếu bàn chưa được gán khu vực. */
  zoneName: string | null;
  onClick: () => void;
  onOrderForCustomer?: (table: TableWithOrders) => void;
  onMarkCleaned?: (table: TableWithOrders) => void;
}

const STATUS_BADGE_VARIANT: Record<TableWithOrders["status"], BadgeProps["variant"]> = {
  available: "success",
  occupied: "destructive",
  payment_pending: "warning",
  needs_cleaning: "secondary",
};

const SHAPE_ICON: Record<TableWithOrders["shape"], typeof Square> = {
  square: Square,
  round: Circle,
  rectangle: RectangleHorizontal,
};

/**
 * Chế độ "Danh sách" của `/staff/tables` (Module 13) — cùng dữ liệu và hành
 * động với TableCard (chế độ lưới), chỉ khác cách trình bày: 1 dòng/bàn, dễ
 * quét mắt khi quán đông bàn hơn là nhìn lưới ô vuông.
 */
export function TableListRow({ table, zoneName, onClick, onOrderForCustomer, onMarkCleaned }: TableListRowProps) {
  const total = table.activeOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const itemCount = table.activeOrders.reduce(
    (sum, order) => sum + order.order_items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const hasPendingCall = table.pendingStaffCalls.length > 0;
  const ShapeIcon = SHAPE_ICON[table.shape];

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

  function handleMarkCleanedClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onMarkCleaned?.(table);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors active:bg-accent"
    >
      <ShapeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold">Bàn {table.table_number}</span>
          {zoneName && <span className="text-xs text-muted-foreground">· {zoneName}</span>}
          <Badge variant={STATUS_BADGE_VARIANT[table.status]}>{TABLE_STATUS_LABEL[table.status]}</Badge>
          {hasPendingCall && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <Bell className="h-3 w-3 animate-pulse" />
              {table.pendingStaffCalls.length} yêu cầu
            </span>
          )}
        </div>
        {table.activeOrders.length > 0 && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {itemCount} món · <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </p>
        )}
      </div>

      {table.status === "needs_cleaning" && onMarkCleaned ? (
        <button
          type="button"
          onClick={handleMarkCleanedClick}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-200"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Đã dọn xong
        </button>
      ) : (
        onOrderForCustomer && (
          <button
            type="button"
            onClick={handleOrderForCustomerClick}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Gọi món hộ
          </button>
        )
      )}
    </div>
  );
}
