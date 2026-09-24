"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateCashDiscrepancy } from "@/lib/shifts";
import { cn, formatCurrency } from "@/lib/utils";
import { SHIFT_STATUS_LABEL, type ShiftWithStaff } from "@/types";
import { Pencil } from "lucide-react";

interface ShiftsTableProps {
  shifts: ShiftWithStaff[];
  loading: boolean;
  onSelect: (shift: ShiftWithStaff) => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/** Lịch sử ca làm việc toàn quán — mới nhất trước. Bấm 1 dòng để xem chi tiết + đối chiếu chênh lệch tiền mặt. */
export function ShiftsTable({ shifts, loading, onSelect }: ShiftsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có ca làm việc nào.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nhân viên</th>
            <th className="px-4 py-3 font-medium">Bắt đầu</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Kết thúc</th>
            <th className="px-4 py-3 text-right font-medium">Tiền mặt thu</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Chuyển khoản</th>
            <th className="px-4 py-3 text-right font-medium">Chênh lệch</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((shift) => {
            const discrepancy = calculateCashDiscrepancy(shift);
            return (
              <tr
                key={shift.id}
                onClick={() => onSelect(shift)}
                className="cursor-pointer border-t transition-colors hover:bg-accent"
              >
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {shift.staffName}
                    {shift.admin_note && (
                      <Pencil
                        className="h-3.5 w-3.5 shrink-0 text-amber-600"
                        aria-label="Đã được chủ quán chỉnh sửa"
                      />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDateTime(shift.start_time)}</td>
                <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                  {formatDateTime(shift.end_time)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(shift.total_revenue_cash)}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                  {formatCurrency(shift.total_revenue_transfer)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-medium tabular-nums",
                    discrepancy !== null && discrepancy !== 0 && "text-destructive"
                  )}
                >
                  {discrepancy === null ? "—" : `${discrepancy > 0 ? "+" : ""}${formatCurrency(discrepancy)}`}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={shift.status === "active" ? "warning" : "outline"}>
                    {SHIFT_STATUS_LABEL[shift.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
