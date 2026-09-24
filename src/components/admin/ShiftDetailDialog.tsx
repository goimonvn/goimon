"use client";

import { ShiftSummaryCard } from "@/components/staff/ShiftSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHIFT_STATUS_LABEL, type ShiftWithStaff } from "@/types";

interface ShiftDetailDialogProps {
  shift: ShiftWithStaff | null;
  onOpenChange: (open: boolean) => void;
  /** Module 14: mở dialog "Đóng ca hộ" — chỉ hiện nút khi ca đang mở. */
  onOpenCloseShift: (shift: ShiftWithStaff) => void;
  /** Module 14: mở dialog "Sửa số liệu" (tiền đầu ca/tiền mặt thực đếm). */
  onOpenEditShift: (shift: ShiftWithStaff) => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Đang mở";
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Chi tiết 1 ca làm việc cho chủ quán — tái sử dụng `ShiftSummaryCard` (component
 * dùng chung với màn "Báo cáo chốt ca" của nhân viên) để đảm bảo số liệu và
 * công thức tính chênh lệch hiển thị NHẤT QUÁN ở cả 2 nơi.
 *
 * Từ Module 14: thêm 2 hành động cho chủ quán — "Đóng ca hộ" (chỉ hiện khi ca
 * đang mở, cho trường hợp nhân viên quên kết thúc ca) và "Sửa số liệu" (sửa
 * tiền đầu ca/tiền mặt thực đếm khi nhân viên gõ/đếm nhầm). Cả 2 dialog con
 * đều nằm ở trang cha (`admin/shifts/page.tsx`), component này chỉ phát tín
 * hiệu mở — giống hệt cách `TableDetailSheet` chuyển sang `PaymentConfirmSheet`
 * ở `/staff/tables`. Nếu ca từng bị chỉnh sửa, hiện luôn `admin_note` kèm tên
 * người sửa + thời điểm để minh bạch, tránh nhân viên bất ngờ khi thấy số
 * liệu khác lúc họ tự chốt ca.
 */
export function ShiftDetailDialog({
  shift,
  onOpenChange,
  onOpenCloseShift,
  onOpenEditShift,
}: ShiftDetailDialogProps) {
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

            {shift.admin_note && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">
                  Chủ quán đã chỉnh sửa ca này
                  {shift.editorName ? ` — ${shift.editorName}` : ""}
                  {shift.edited_at ? ` (${formatDateTime(shift.edited_at)})` : ""}
                </p>
                <p className="mt-1">{shift.admin_note}</p>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2 sm:justify-start">
              {shift.status === "active" && (
                <Button type="button" variant="outline" onClick={() => onOpenCloseShift(shift)}>
                  Đóng ca hộ
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenEditShift(shift)}>
                Sửa số liệu
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
