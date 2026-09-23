"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Hộp thoại xác nhận dùng chung cho các thao tác xoá (danh mục/món/option) trong khu vực quản trị. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xoá",
  destructive = true,
  submitting = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={submitting}>
            {submitting ? "Đang xử lý..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
