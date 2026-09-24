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
import { adminUpdateShiftCash } from "@/services/shift.service";
import type { ShiftWithStaff } from "@/types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface AdminEditShiftDialogProps {
  shift: ShiftWithStaff | null;
  onOpenChange: (open: boolean) => void;
  /** Gọi ngay sau khi lưu thành công để trang cha refetch, không cần đợi realtime. */
  onSaved: () => void;
}

/**
 * (Chủ quán, Module 14) Sửa "Tiền đầu ca"/"Tiền mặt thực đếm" của 1 ca — dùng
 * khi nhân viên gõ nhầm lúc bắt đầu ca, hoặc đếm nhầm tiền lúc chốt ca. CỐ Ý
 * KHÔNG cho sửa `total_revenue_cash`/`total_revenue_transfer` (luôn tính lại
 * đúng từ `orders` trong RPC `close_shift` — nếu 2 số đó sai, nguyên nhân
 * thật nằm ở dữ liệu đơn hàng, không phải ở ca làm việc, sửa tay ở đây sẽ chỉ
 * làm mất đồng bộ với sổ sách gốc). Trường "Tiền mặt thực đếm" chỉ hiện khi ca
 * ĐÃ đóng — ca đang mở chưa có số này, dùng nút "Đóng ca hộ" nếu cần đóng ca.
 */
export function AdminEditShiftDialog({ shift, onOpenChange, onSaved }: AdminEditShiftDialogProps) {
  const [initialCash, setInitialCash] = useState("");
  const [finalCash, setFinalCash] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shift) {
      setInitialCash(String(shift.initial_cash));
      setFinalCash(shift.final_cash !== null ? String(shift.final_cash) : "");
      setNote("");
    }
  }, [shift]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;

    const initial = Number(initialCash);
    if (!Number.isFinite(initial) || initial < 0) {
      toast.error("Tiền đầu ca không hợp lệ.");
      return;
    }

    let final: number | null = null;
    if (shift.status === "closed") {
      final = Number(finalCash);
      if (!Number.isFinite(final) || final < 0) {
        toast.error("Tiền mặt thực đếm không hợp lệ.");
        return;
      }
    }

    if (!note.trim()) {
      toast.error("Vui lòng nhập lý do chỉnh sửa.");
      return;
    }

    setSubmitting(true);
    try {
      await adminUpdateShiftCash(shift.id, { initialCash: initial, finalCash: final }, note);
      toast.success("Đã cập nhật ca làm việc.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật ca làm việc.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={shift !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {shift && (
          <>
            <DialogHeader>
              <DialogTitle>Sửa số liệu ca — {shift.staffName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-initial-cash">Tiền đầu ca (đ)</Label>
                <Input
                  id="edit-initial-cash"
                  type="number"
                  min={0}
                  step="any"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  autoFocus
                />
              </div>

              {shift.status === "closed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-final-cash">Tiền mặt thực đếm (đ)</Label>
                  <Input
                    id="edit-final-cash"
                    type="number"
                    min={0}
                    step="any"
                    value={finalCash}
                    onChange={(e) => setFinalCash(e.target.value)}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ca đang mở nên chưa có &quot;Tiền mặt thực đếm&quot; — dùng nút &quot;Đóng ca hộ&quot; ở
                  màn chi tiết nếu cần đóng ca này thay nhân viên.
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-shift-note">Lý do chỉnh sửa</Label>
                <Textarea
                  id="edit-shift-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vd: Nhân viên đếm nhầm 50.000đ lúc chốt ca."
                  rows={2}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
