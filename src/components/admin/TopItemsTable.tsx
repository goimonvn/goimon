"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { BestSellerRow } from "@/types";

interface TopItemsTableProps {
  rows: BestSellerRow[];
  loading: boolean;
}

/**
 * Bảng top món bán chạy TRONG khoảng thời gian đang lọc ở `/admin/analytics`
 * — tách khỏi `BestSellerTable` (Module 3, luôn all-time, dùng riêng cho
 * Dashboard) để không đổi hành vi trang đó; 2 component dùng chung kiểu
 * `BestSellerRow` và cách trình bày.
 */
export function TopItemsTable({ rows, loading }: TopItemsTableProps) {
  const maxQuantity = Math.max(1, ...rows.map((r) => r.quantity));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-1 text-base font-semibold">Món bán chạy</h2>
      <p className="mb-4 text-sm text-muted-foreground">Trong khoảng thời gian đã lọc</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có đơn hàng trong khoảng thời gian đã chọn.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Món</th>
                <th className="px-2 py-2 text-right font-medium">Số lượng</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Doanh thu (ước tính)</th>
                <th className="hidden w-32 px-2 py-2 font-medium md:table-cell">Tỉ trọng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.menuItemId} className="border-t">
                  <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{index + 1}</td>
                  <td className="px-2 py-2.5 font-medium">{row.name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{row.quantity}</td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(6, (row.quantity / maxQuantity) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs italic text-muted-foreground">
            * Doanh thu ước tính theo giá món hiện tại (đơn hàng không lưu giá tại thời điểm đặt).
          </p>
        </div>
      )}
    </div>
  );
}
