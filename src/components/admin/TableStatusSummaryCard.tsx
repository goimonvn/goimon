import { cn } from "@/lib/utils";
import { TABLE_STATUS_LABEL } from "@/types";
import type { TableStatus } from "@/types/database.types";
import { LayoutGrid } from "lucide-react";

interface TableStatusSummaryCardProps {
  counts: Record<TableStatus, number>;
  className?: string;
}

const DOT_STYLE: Record<TableStatus, string> = {
  available: "bg-emerald-500",
  occupied: "bg-destructive",
  payment_pending: "bg-amber-500",
  needs_cleaning: "bg-slate-400",
};

/** Thẻ tổng quan nhanh: đếm số bàn theo từng trạng thái — chi tiết từng bàn xem ở lưới bên dưới. */
export function TableStatusSummaryCard({ counts, className }: TableStatusSummaryCardProps) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Tình trạng 15 bàn</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </span>
      </div>
      <p className="mb-2 text-2xl font-bold">{total} bàn</p>
      <ul className="space-y-1">
        {(Object.keys(TABLE_STATUS_LABEL) as TableStatus[]).map((status) => (
          <li key={status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", DOT_STYLE[status])} />
              {TABLE_STATUS_LABEL[status]}
            </span>
            <span className="font-medium tabular-nums">{counts[status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
