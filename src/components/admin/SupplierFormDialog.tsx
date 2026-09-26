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
import { Textarea } from "@/components/ui/textarea";
import { createSupplier, updateSupplier } from "@/services/purchasing.service";
import type { SuppliersRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface SupplierFormDialogProps {
  open: boolean;
  /** null = đang tạo nhà cung cấp mới. */
  supplier: SuppliersRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Form thêm/sửa nhà cung cấp — CRUD đầy đủ (khác PurchaseReceiptFormDialog bên dưới — phiếu nhập chỉ tạo, không sửa). */
export function SupplierFormDialog({ open, supplier, onOpenChange, onSaved }: SupplierFormDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? "");
    setPhone(supplier?.phone ?? "");
    setAddress(supplier?.address ?? "");
    setNote(supplier?.note ?? "");
  }, [open, supplier]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên nhà cung cấp.");
      return;
    }

    const input = { name: trimmedName, phone, address, note };

    setSubmitting(true);
    try {
      if (supplier) {
        await updateSupplier(supplier.id, input);
        toast.success("Đã cập nhật nhà cung cấp.");
      } else {
        await createSupplier(input);
        toast.success("Đã thêm nhà cung cấp mới.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu nhà cung cấp.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-name">Tên nhà cung cấp</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Rang xay Minh Tiến"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-phone">Số điện thoại (không bắt buộc)</Label>
            <Input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-address">Địa chỉ (không bắt buộc)</Label>
            <Input id="supplier-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="supplier-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ví dụ: chuyên cà phê hạt, giao hàng thứ 2-6..."
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
