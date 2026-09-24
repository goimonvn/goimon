"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ExpenseFormDialog } from "@/components/admin/ExpenseFormDialog";
import { ExpensesTable } from "@/components/admin/ExpensesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/admin/StatCard";
import { useExpenses } from "@/hooks/useExpenses";
import { shopDateString } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { deleteExpense, getTotalExpenses, subscribeToExpenseChanges } from "@/services/expense.service";
import { EXPENSE_CATEGORY_LABEL, type ExpenseFilters, type ExpenseWithCreator } from "@/types";
import type { ExpenseCategory } from "@/types/database.types";
import { CircleDollarSign, Plus, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** "yyyy-MM-dd" -> "yyyy-MM-01" của CÙNG tháng, dùng chung 1 chuỗi ngày đã có (tránh tự dựng lại Date rồi lại phải quy đổi giờ quán lần 2). */
function firstDayOfSameMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Thẻ "Tổng chi phí tháng này" — độc lập với bộ lọc bảng bên dưới (luôn tính đúng tháng hiện tại theo giờ quán), tự làm mới khi có khoản chi mới/bị xoá. */
function useMonthlyExpenseTotal(): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = shopDateString();
      try {
        const value = await getTotalExpenses(firstDayOfSameMonth(today), today);
        if (!cancelled) setTotal(value);
      } catch {
        // Thẻ phụ — không toast chặn trang nếu lỗi, bảng chi phí bên dưới đã báo lỗi đủ rõ.
      }
    }

    void load();
    const channel = subscribeToExpenseChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return total;
}

const CATEGORY_FILTER_OPTIONS: (ExpenseCategory | "all")[] = ["all", "ingredient", "utility", "salary", "other"];

export default function AdminExpensesPage() {
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseWithCreator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filters: ExpenseFilters = {
    category,
    fromDate: fromDate || null,
    toDate: toDate || null,
  };
  const { expenses, loading, refetch } = useExpenses(filters);
  const monthlyTotal = useMonthlyExpenseTotal();

  const filteredTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  async function handleConfirmDelete() {
    if (!deletingExpense) return;
    setDeleting(true);
    try {
      await deleteExpense(deletingExpense.id);
      toast.success("Đã xoá khoản chi.");
      setDeletingExpense(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá khoản chi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Chi phí</h1>
          <p className="text-sm text-muted-foreground">
            Ghi nhận chi phí quán (nguyên liệu, điện nước, lương...) để tính lợi nhuận gộp.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Thêm khoản chi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Tổng chi phí tháng này"
          value={monthlyTotal !== null ? formatCurrency(monthlyTotal) : "…"}
          icon={CircleDollarSign}
        />
        <StatCard label="Tổng theo bộ lọc hiện tại" value={formatCurrency(filteredTotal)} icon={Receipt} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory | "all")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTER_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all" ? "Tất cả phân loại" : EXPENSE_CATEGORY_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
        <span className="text-sm text-muted-foreground">đến</span>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
        {(fromDate || toDate || category !== "all") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("all");
              setFromDate("");
              setToDate("");
            }}
          >
            Xoá bộ lọc
          </Button>
        )}
      </div>

      <ExpensesTable expenses={expenses} loading={loading} onDelete={setDeletingExpense} />

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={refetch} />

      <ConfirmDialog
        open={deletingExpense !== null}
        title="Xoá khoản chi?"
        description={`Khoản chi "${deletingExpense?.title ?? ""}" sẽ bị xoá vĩnh viễn.`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
