"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { StaffPerformanceRow } from "@/types";

interface StaffPerformanceTableProps {
  rows: StaffPerformanceRow[];
  loading: boolean;
}

/** Bảng so sánh hiệu suất từng nhân viên — mọi cột đều là số liệu suy ra từ ca làm việc + đơn đã xác nhận thanh toán tại quầy, xem `shift.service.ts#getStaffPerformance`. */
export function StaffPerformanceTable({ rows, loading }: StaffPerformanceTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có ca làm việc nào trong khoảng thời gian đã chọn.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="w-8 px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Nhân viên</th>
            <th className="px-4 py-3 text-right font-medium">Số ca</th>
            <th className="px-4 py-3 text-right font-medium">Tổng doanh thu</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Doanh thu TB / ca</th>
            <th className="px-4 py-3 text-right font-medium">Tổng số đơn</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Số đơn TB / ca</th>
            <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Doanh thu TB / đơn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.staffId} className="border-t">
              <td className="px-4 py-3 text-muted-foreground tabular-nums">{index + 1}</td>
              <td className="px-4 py-3 font-medium">{row.staffName}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.shiftsCount}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(row.totalRevenue)}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                {formatCurrency(row.avgRevenuePerShift)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.totalOrders}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{row.avgOrdersPerShift}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
                {formatCurrency(row.avgRevenuePerOrder)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
