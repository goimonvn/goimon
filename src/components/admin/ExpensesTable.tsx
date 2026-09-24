"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABEL, type ExpenseWithCreator } from "@/types";
import type { ExpenseCategory } from "@/types/database.types";
import { Trash2 } from "lucide-react";

interface ExpensesTableProps {
  expenses: ExpenseWithCreator[];
  loading: boolean;
  onDelete: (expense: ExpenseWithCreator) => void;
}

const CATEGORY_BADGE_VARIANT: Record<ExpenseCategory, "secondary" | "warning" | "destructive" | "outline"> = {
  ingredient: "secondary",
  utility: "warning",
  salary: "outline",
  other: "outline",
};

function formatDate(dateStr: string): string {
  // `expense_date` là cột DATE ("yyyy-MM-dd") — parse trực tiếp bằng
  // "T00:00:00" (giờ ĐỊA PHƯƠNG của trình duyệt admin đang xem, không quy đổi
  // UTC) để tránh lùi 1 ngày khi hiển thị, khác các cột timestamptz khác trong
  // dự án vốn parse thẳng bằng `new Date(iso)`.
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Bảng danh sách chi phí — hỗ trợ xoá (không sửa, xem ghi chú ở ExpenseFormDialog). */
export function ExpensesTable({ expenses, loading, onDelete }: ExpensesTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có khoản chi nào khớp bộ lọc hiện tại.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Ngày chi</th>
            <th className="px-4 py-3 font-medium">Tên khoản chi</th>
            <th className="px-4 py-3 font-medium">Phân loại</th>
            <th className="px-4 py-3 text-right font-medium">Số tiền</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Người tạo</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="border-t align-top">
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDate(expense.expense_date)}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{expense.title}</div>
                {expense.note && <div className="max-w-xs truncate text-xs text-muted-foreground">{expense.note}</div>}
              </td>
              <td className="px-4 py-3">
                <Badge variant={CATEGORY_BADGE_VARIANT[expense.category]}>
                  {EXPENSE_CATEGORY_LABEL[expense.category]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-destructive">
                -{formatCurrency(expense.amount)}
              </td>
              <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                {expense.createdByName ?? "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(expense)}
                  aria-label="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
