"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { PurchaseReceiptWithSupplier } from "@/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

interface PurchaseReceiptsTableProps {
  receipts: PurchaseReceiptWithSupplier[];
  loading: boolean;
}

function formatDate(dateStr: string): string {
  // Cùng cách parse "yyyy-MM-dd" của ExpensesTable#formatDate — tránh lùi 1
  // ngày do quy đổi UTC.
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Bảng danh sách phiếu nhập hàng — CHỈ XEM (không sửa/xoá, sổ sách bất biến,
 * xem purchasing.service.ts). Mỗi dòng có thể bấm mở rộng để xem chi tiết
 * từng nguyên liệu trong phiếu (đã tải sẵn kèm theo, không lazy-load).
 */
export function PurchaseReceiptsTable({ receipts, loading }: PurchaseReceiptsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Chưa có phiếu nhập hàng nào.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-3"></th>
            <th className="px-4 py-3 font-medium">Ngày nhập</th>
            <th className="px-4 py-3 font-medium">Nhà cung cấp</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Số dòng</th>
            <th className="px-4 py-3 text-right font-medium">Tổng tiền</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => {
            const expanded = expandedIds.has(receipt.id);
            return (
              <Fragment key={receipt.id}>
                <tr
                  className="cursor-pointer border-t align-top hover:bg-muted/40"
                  onClick={() => toggleExpanded(receipt.id)}
                >
                  <td className="px-2 py-3 text-muted-foreground">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDate(receipt.receipt_date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{receipt.supplierName}</div>
                    {receipt.note && <div className="max-w-xs truncate text-xs text-muted-foreground">{receipt.note}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{receipt.items.length}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(receipt.total_amount)}</td>
                </tr>
                {expanded && (
                  <tr className="border-t bg-muted/20">
                    <td></td>
                    <td colSpan={4} className="px-4 py-3">
                      <ul className="space-y-1">
                        {receipt.items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between text-xs">
                            <span>
                              {item.ingredientName} — {item.quantity} {item.ingredientUnit} × {formatCurrency(item.unitCost)}
                            </span>
                            <span className="font-medium tabular-nums">{formatCurrency(item.lineTotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
