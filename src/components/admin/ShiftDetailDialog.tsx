"use client";

import { ShiftSummaryCard } from "@/components/staff/ShiftSummaryCard";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHIFT_STATUS_LABEL, type ShiftWithStaff } from "@/types";

interface ShiftDetailDialogProps {
  shift: ShiftWithStaff | null;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Đang mở";
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Chi tiết 1 ca làm việc cho chủ quán — tái sử dụng `ShiftSummaryCard` (component
 * dùng chung với màn "Báo cáo chốt ca" của nhân viên) để đảm bảo số liệu và
 * công thức tính chênh lệch hiển thị NHẤT QUÁN ở cả 2 nơi.
 */
export function ShiftDetailDialog({ shift, onOpenChange }: ShiftDetailDialogProps) {
  return (
    <Dialog open={shift !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {shift && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {shift.staffName}
                <Badge variant={shift.status === "active" ? "warning" : "outline"}>
                  {SHIFT_STATUS_LABEL[shift.status]}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Bắt đầu</dt>
                <dd className="font-medium">{formatDateTime(shift.start_time)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Kết thúc</dt>
                <dd className="font-medium">{formatDateTime(shift.end_time)}</dd>
              </div>
            </dl>
            <ShiftSummaryCard shift={shift} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
