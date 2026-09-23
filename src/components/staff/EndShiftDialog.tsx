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
import { closeShift } from "@/services/shift.service";
import type { CloseShiftResultRow, ShiftsRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShiftSummaryCard } from "./ShiftSummaryCard";

interface EndShiftDialogProps {
  open: boolean;
  shift: ShiftsRow | null;
  onOpenChange: (open: boolean) => void;
  /** Gọi sau khi ca đã đóng thành công (đóng dialog xong) để widget cập nhật lại trạng thái "chưa có ca". */
  onClosed: () => void;
}

/**
 * Dialog "Kết thúc ca" — 2 bước:
 * 1. "confirm": nhân viên nhập tiền mặt THỰC ĐẾM trong ngăn kéo -> gọi RPC `close_shift`.
 * 2. "report": hiển thị Báo cáo chốt ca (kết quả trả về từ bước 1) — nhân viên xem xong bấm "Hoàn tất" mới đóng dialog,
 *    tránh trường hợp lỡ tay đóng dialog mà chưa kịp đọc số liệu bàn giao ca.
 */
export function EndShiftDialog({ open, shift, onOpenChange, onClosed }: EndShiftDialogProps) {
  const [step, setStep] = useState<"confirm" | "report">("confirm");
  const [finalCash, setFinalCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<CloseShiftResultRow | null>(null);

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setFinalCash("");
      setReport(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;

    const amount = Number(finalCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Tiền mặt thực đếm không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await closeShift(shift.id, amount);
      setReport(result);
      setStep("report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể kết thúc ca làm việc.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinish() {
    onClosed();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={step === "confirm" ? onOpenChange : undefined}>
      <DialogContent>
        {step === "confirm" && shift && (
          <>
            <DialogHeader>
              <DialogTitle>Kết thúc ca làm việc</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Đếm tiền mặt hiện có trong ngăn kéo và nhập vào bên dưới để hệ thống tính chênh lệch.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="final-cash">Tiền mặt thực đếm (đ)</Label>
                <Input
                  id="final-cash"
                  type="number"
                  min={0}
                  step="any"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Đang kết thúc..." : "Kết thúc ca"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "report" && report && (
          <>
            <DialogHeader>
              <DialogTitle>Báo cáo chốt ca</DialogTitle>
            </DialogHeader>
            <ShiftSummaryCard shift={report} orderCount={report.order_count} />
            <DialogFooter>
              <Button onClick={handleFinish}>Hoàn tất</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
