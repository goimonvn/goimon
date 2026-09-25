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
import { parseReservationForm } from "@/lib/validation";
import { createStaffReservation } from "@/services/reservation.service";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * "Tạo đặt bàn" thủ công ở `/staff/reservations` — dùng khi khách gọi điện
 * thẳng tới quán thay vì tự đặt qua link `/dat-ban` công khai. Tạo THẲNG ở
 * trạng thái 'confirmed' (xem reservation.service.createStaffReservation) vì
 * nhân viên đang nói chuyện trực tiếp với khách, không cần bước gọi lại xác
 * nhận như lượt khách tự đặt.
 */
export function ReservationFormDialog({ open, onOpenChange, onSaved }: ReservationFormDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservationTime, setReservationTime] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setPartySize("2");
    setReservationTime("");
    setNote("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = parseReservationForm({
      customerName,
      customerPhone,
      partySize,
      reservationTime,
      note,
    });
    if (!parsed.success) {
      toast.error(parsed.error);
      return;
    }

    setSubmitting(true);
    try {
      await createStaffReservation(parsed.data);
      toast.success("Đã tạo đặt bàn (đã xác nhận).");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo đặt bàn.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo đặt bàn (khách gọi điện)</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Tên khách</Label>
            <Input
              id="res-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ví dụ: Chị Lan"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-phone">Số điện thoại</Label>
              <Input
                id="res-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="09xxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-party-size">Số khách</Label>
              <Input
                id="res-party-size"
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-time">Ngày giờ đặt bàn</Label>
            <Input
              id="res-time"
              type="datetime-local"
              value={reservationTime}
              onChange={(e) => setReservationTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="res-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ví dụ: muốn ngồi ngoài sân vườn, có trẻ nhỏ..."
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
