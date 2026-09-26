"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { MenuItemMargin } from "@/types";
import { useMemo } from "react";

interface MenuItemMarginTableProps {
  margins: MenuItemMargin[];
  loading: boolean;
}

/** Ngưỡng phân loại biên lợi nhuận — CHỈ để tô màu badge tham khảo nhanh, không phải chuẩn kế toán cố định, chủ quán có thể tự đánh giá theo con số thật. */
function marginBadge(marginPercent: number): { label: string; variant: "success" | "warning" | "destructive" } {
  if (marginPercent >= 40) return { label: `${marginPercent}%`, variant: "success" };
  if (marginPercent >= 15) return { label: `${marginPercent}%`, variant: "warning" };
  return { label: `${marginPercent}%`, variant: "destructive" };
}

/**
 * Bảng giá vốn/biên lợi nhuận theo món (Module 20) — thay thế cho việc chỉ
 * biết "lợi nhuận gộp hôm nay" theo NGÀY (Module 12): ở đây thấy được MÓN
 * NÀO đang lời nhiều/ít. Sắp xếp biên lợi nhuận THẤP -> CAO (món có vấn đề
 * lên đầu) — món CHƯA đủ dữ liệu giá vốn (hasCostData = false, xem
 * purchasing.service.ts#getMenuItemMargins) xếp cuối, tách riêng khỏi thứ tự
 * biên lợi nhuận vì không so sánh được.
 */
export function MenuItemMarginTable({ margins, loading }: MenuItemMarginTableProps) {
  const sorted = useMemo(() => {
    const withData = margins.filter((m) => m.hasCostData && m.marginPercent !== null);
    const withoutData = margins.filter((m) => !m.hasCostData || m.marginPercent === null);
    withData.sort((a, b) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0));
    return [...withData, ...withoutData];
  }, [margins]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có món nào trong menu.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Món</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Danh mục</th>
            <th className="px-4 py-3 text-right font-medium">Giá bán</th>
            <th className="px-4 py-3 text-right font-medium">Giá vốn</th>
            <th className="px-4 py-3 text-right font-medium">Lợi nhuận</th>
            <th className="px-4 py-3 text-right font-medium">Biên</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.menuItemId} className="border-t align-top">
              <td className="px-4 py-3 font-medium">{item.menuItemName}</td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{item.categoryName}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.price)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {item.cost !== null ? formatCurrency(item.cost) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {item.margin !== null ? formatCurrency(item.margin) : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {item.hasCostData && item.marginPercent !== null ? (
                  (() => {
                    const badge = marginBadge(item.marginPercent);
                    return <Badge variant={badge.variant}>{badge.label}</Badge>;
                  })()
                ) : (
                  <Badge variant="outline">Thiếu dữ liệu</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        &quot;Thiếu dữ liệu&quot;: món chưa có công thức, hoặc có nguyên liệu chưa từng được ghi phiếu nhập hàng nào (giá vốn đang mặc định 0).
      </p>
    </div>
  );
}
