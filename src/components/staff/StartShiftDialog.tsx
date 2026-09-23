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
import { startShift } from "@/services/shift.service";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface StartShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}

/** Dialog "Bắt đầu ca" — nhân viên nhập tiền mặt đầu ca (tiền lẻ trong ngăn kéo) trước khi bắt đầu bán hàng. */
export function StartShiftDialog({ open, onOpenChange, onStarted }: StartShiftDialogProps) {
  const [initialCash, setInitialCash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setInitialCash("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const amount = Number(initialCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Tiền đầu ca không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      await startShift(amount);
      toast.success("Đã bắt đầu ca làm việc.");
      onStarted();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể bắt đầu ca làm việc.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bắt đầu ca làm việc</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="initial-cash">Tiền mặt đầu ca (đ)</Label>
            <Input
              id="initial-cash"
              type="number"
              min={0}
              step="any"
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Số tiền mặt hiện có trong ngăn kéo trước khi bắt đầu bán hàng.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang bắt đầu..." : "Bắt đầu ca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
