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
import { createVatInvoice } from "@/services/vatInvoice.service";
import { useState } from "react";
import { toast } from "sonner";

interface VatInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

interface FormState {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

const EMPTY_FORM: FormState = { companyName: "", taxCode: "", address: "", email: "" };
const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function VatInvoiceDialog({ open, onOpenChange, orderId }: VatInvoiceDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.companyName.trim()) return "Vui lòng nhập tên công ty.";
    if (!TAX_CODE_PATTERN.test(form.taxCode.trim()))
      return "Mã số thuế không hợp lệ (10 số, hoặc 10 số-3 số chi nhánh).";
    if (!form.address.trim()) return "Vui lòng nhập địa chỉ công ty.";
    if (!EMAIL_PATTERN.test(form.email.trim())) return "Email nhận hoá đơn không hợp lệ.";
    return null;
  }

  async function handleSubmit() {
    if (!orderId) {
      toast.error("Không tìm thấy đơn hàng để xuất hoá đơn.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await createVatInvoice(orderId, {
        companyName: form.companyName.trim(),
        taxCode: form.taxCode.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
      });
      toast.success("Đã ghi nhận thông tin xuất hoá đơn VAT. Hoá đơn sẽ được gửi qua email.");
      setForm(EMPTY_FORM);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu thông tin hoá đơn.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Cùng lý do như ItemOptionsSheet.tsx: chặn Radix tự động focus vào ô
        // "Tên công ty" (input đầu tiên) khi dialog mở, tránh bàn phím ảo che
        // mất nội dung ngay khi khách vừa mở form xuất hoá đơn VAT trên di
        // động.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Xuất hoá đơn VAT</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Tên công ty</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxCode">Mã số thuế</Label>
            <Input
              id="taxCode"
              placeholder="0312345678"
              value={form.taxCode}
              onChange={(e) => update("taxCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Địa chỉ</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email nhận hoá đơn</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            Gửi thông tin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
