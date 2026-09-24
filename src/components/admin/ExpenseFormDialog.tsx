"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shopDateString } from "@/lib/analytics";
import { createExpense } from "@/services/expense.service";
import { EXPENSE_CATEGORY_LABEL, type ExpenseFormInput } from "@/types";
import type { ExpenseCategory } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Form thêm khoản chi mới (Module 12) — CHỈ tạo, không sửa (giống quy ước đơn
 * giản của vat_invoices/feedbacks: chi phí nhập sai thì xoá rồi nhập lại thay
 * vì mở thêm luồng "sửa", xem expense.service.ts). `expenseDate` mặc định
 * NGÀY HÔM NAY theo giờ quán (shopDateString, không phải giờ máy đang mở form
 * — quan trọng khi admin thao tác gần nửa đêm).
 */
export function ExpenseFormDialog({ open, onOpenChange, onSaved }: ExpenseFormDialogProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("ingredient");
  const [expenseDate, setExpenseDate] = useState(shopDateString());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAmount("");
    setCategory("ingredient");
    setExpenseDate(shopDateString());
    setNote("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Vui lòng nhập tên khoản chi.");
      return;
    }
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Số tiền không hợp lệ.");
      return;
    }
    if (!expenseDate) {
      toast.error("Vui lòng chọn ngày chi.");
      return;
    }

    const input: ExpenseFormInput = {
      title: trimmedTitle,
      amount: amountNumber,
      category,
      note,
      expenseDate,
    };

    setSubmitting(true);
    try {
      await createExpense(input);
      toast.success("Đã ghi nhận khoản chi.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu khoản chi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm khoản chi</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-title">Tên khoản chi</Label>
            <Input
              id="expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Nhập cà phê hạt, Tiền điện tháng 9..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Số tiền (đ)</Label>
              <Input
                id="expense-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phân loại</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {EXPENSE_CATEGORY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Ngày chi</Label>
            <Input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Hoá đơn số..., nhà cung cấp..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
