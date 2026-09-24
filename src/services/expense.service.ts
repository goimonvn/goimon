import { supabase } from "@/lib/supabase/client";
import { AppError, type ExpenseFilters, type ExpenseFormInput, type ExpenseWithCreator } from "@/types";
import type { ExpensesRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Danh sách chi phí (Module 12), lọc theo phân loại + khoảng ngày `expense_date`
 * (KHÔNG phải `created_at` — chủ quán có thể nhập bù chi phí của ngày trước,
 * lọc/thống kê phải theo đúng ngày chi thực tế). Mới nhất trước (theo ngày chi,
 * rồi tới lúc tạo). RLS chỉ cho phép admin đọc (xem schema.sql), khớp cách
 * `getAllPromotions`/`getShiftHistory` không cần thêm điều kiện WHERE theo role
 * ở tầng client.
 */
export async function getExpenses(filters: ExpenseFilters): Promise<ExpenseWithCreator[]> {
  let query = supabase
    .from("expenses")
    .select("*, creator:profiles(full_name, email)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.fromDate) {
    query = query.gte("expense_date", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("expense_date", filters.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("Không thể tải danh sách chi phí.", error);
  }

  // Xem ghi chú ở shift.service.ts#getShiftHistory về việc ép kiểu tường minh cho trường embed.
  type RawRow = ExpensesRow & { creator: { full_name: string | null; email: string } | null };
  return ((data ?? []) as unknown as RawRow[]).map(({ creator, ...rest }) => ({
    ...rest,
    createdByName: creator?.full_name || creator?.email || null,
  }));
}

export async function createExpense(input: ExpenseFormInput): Promise<ExpensesRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      title: input.title,
      amount: input.amount,
      category: input.category,
      note: input.note.trim() || null,
      expense_date: input.expenseDate,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Không thể tạo khoản chi mới.", error);
  }
  return data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) {
    throw new AppError("Không thể xoá khoản chi.", error);
  }
}

/**
 * Tổng chi phí trong khoảng `[startDate, endDate]` (cả 2 đầu, dạng "yyyy-MM-dd")
 * — dùng cho thẻ "Tổng chi phí" + tính Lợi nhuận gộp ở Dashboard
 * (analytics.service.ts#getDashboardSummary) và thẻ thống kê tháng ở
 * `/admin/expenses`. Cộng ở tầng client (giống mọi tổng hợp khác trong dự án,
 * xem getDashboardSummary#revenueToday) — số lượng chi phí của 1 quán nhỏ,
 * không cần RPC `sum()` riêng.
 */
export async function getTotalExpenses(startDate: string, endDate: string): Promise<number> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  if (error) {
    throw new AppError("Không thể tính tổng chi phí.", error);
  }
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/** Realtime: bảng /admin/expenses + thẻ Dashboard tự cập nhật khi có khoản chi mới/bị xoá. */
export function subscribeToExpenseChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:expenses")
    .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => onChange())
    .subscribe();
}
