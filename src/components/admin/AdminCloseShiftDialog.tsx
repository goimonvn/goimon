"use client";

import { ShiftSummaryCard } from "@/components/staff/ShiftSummaryCard";
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
import { adminCloseShift } from "@/services/shift.service";
import type { ShiftWithStaff } from "@/types";
import type { CloseShiftResultRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface AdminCloseShiftDialogProps {
  shift: ShiftWithStaff | null;
  onOpenChange: (open: boolean) => void;
  /** Gọi sau khi đóng ca hộ thành công (bấm "Hoàn tất" ở bước báo cáo) để trang cha refetch ngay, không cần đợi realtime. */
  onClosed: () => void;
}

/**
 * (Chủ quán, Module 14) Đóng ca HỘ 1 nhân viên đã quên bấm "Kết thúc ca" ở
 * thiết bị của họ — cùng khuôn mẫu 2 bước (confirm -> report) với
 * `EndShiftDialog` của nhân viên, tái sử dụng nguyên `ShiftSummaryCard`, chỉ
 * khác 2 điểm: (1) mở được cho BẤT KỲ ca đang mở nào, không riêng ca của
 * người đang đăng nhập; (2) bắt buộc nhập lý do — `adminCloseShift` ghi lý
 * do này vào `admin_note`/`edited_by`/`edited_at` ngay trong RPC `close_shift`,
 * để có dấu vết rõ ràng ai đã đóng ca hộ và vì sao.
 */
export function AdminCloseShiftDialog({ shift, onOpenChange, onClosed }: AdminCloseShiftDialogProps) {
  const [step, setStep] = useState<"confirm" | "report">("confirm");
  const [finalCash, setFinalCash] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<CloseShiftResultRow | null>(null);

  useEffect(() => {
    if (shift) {
      setStep("confirm");
      setFinalCash("");
      setNote("");
      setReport(null);
    }
  }, [shift]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;

    const amount = Number(finalCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Tiền mặt thực đếm không hợp lệ.");
      return;
    }
    if (!note.trim()) {
      toast.error("Vui lòng nhập lý do đóng ca hộ.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminCloseShift(shift.id, amount, note);
      setReport(result);
      setStep("report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng ca hộ.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinish() {
    onClosed();
    onOpenChange(false);
  }

  return (
    <Dialog open={shift !== null} onOpenChange={step === "confirm" ? onOpenChange : undefined}>
      <DialogContent>
        {step === "confirm" && shift && (
          <>
            <DialogHeader>
              <DialogTitle>Đóng ca hộ — {shift.staffName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Dùng khi nhân viên đã rời quán mà quên bấm &quot;Kết thúc ca&quot;. Hệ thống vẫn tự
                tính đúng doanh thu tiền mặt/chuyển khoản của ca này từ các đơn đã thu tiền, chỉ khác
                là chủ quán nhập hộ số tiền mặt thực đếm được trong ngăn kéo.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="admin-final-cash">Tiền mặt thực đếm (đ)</Label>
                <Input
                  id="admin-final-cash"
                  type="number"
                  min={0}
                  step="any"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-close-note">Lý do đóng ca hộ</Label>
                <Textarea
                  id="admin-close-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vd: Nhân viên quên kết thúc ca trước khi ra về."
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Đang đóng ca..." : "Đóng ca hộ"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "report" && report && shift && (
          <>
            <DialogHeader>
              <DialogTitle>Đã đóng ca hộ {shift.staffName}</DialogTitle>
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
