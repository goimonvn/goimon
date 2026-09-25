"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseReservationForm } from "@/lib/validation";
import { createReservation } from "@/services/reservation.service";
import { CalendarCheck, CalendarClock, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

/**
 * `/dat-ban` — link công khai để khách tự đặt bàn trước từ xa (Module 18),
 * KHÔNG gắn với 1 bàn cụ thể (khác `/order?table=X`) vì lúc đặt chưa biết sẽ
 * ngồi bàn nào — quán mới là người gán bàn sau, xem `/staff/reservations`.
 *
 * Gửi xong CHỈ hiện thông báo đã ghi nhận — KHÔNG có mã tra cứu/link huỷ
 * riêng cho khách (quyết định rõ ràng của quán: mọi thay đổi sau đó khách gọi
 * điện trực tiếp, nhân viên xử lý qua `/staff/reservations`). Quán sẽ tự gọi
 * lại xác nhận trong ít phút/giờ tới (xác nhận hoàn toàn thủ công, không đặt
 * cọc — xem reservation.service.ts#createReservation).
 */
export default function PublicReservationPage() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservationTime, setReservationTime] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      await createReservation(parsed.data);
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu đặt bàn.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setCustomerName("");
    setCustomerPhone("");
    setPartySize("2");
    setReservationTime("");
    setNote("");
    setSubmitted(false);
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Đặt bàn trước</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Điền thông tin bên dưới, quán sẽ gọi lại để xác nhận với bạn.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <CalendarCheck className="mx-auto h-10 w-10 text-emerald-600" />
          <div>
            <p className="font-semibold">Đã ghi nhận yêu cầu đặt bàn!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quán sẽ gọi điện tới số {customerPhone} để xác nhận trong thời gian sớm nhất. Nếu
              cần thay đổi hoặc huỷ, vui lòng gọi điện trực tiếp cho quán.
            </p>
          </div>
          <Button variant="outline" onClick={handleReset} className="w-full">
            Đặt thêm lượt khác
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="pub-res-name">Tên khách</Label>
            <Input
              id="pub-res-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ví dụ: Chị Lan"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-res-phone">Số điện thoại</Label>
            <Input
              id="pub-res-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="09xxxxxxxx"
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              Quán dùng số này để gọi lại xác nhận.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-res-party-size">Số khách</Label>
            <Input
              id="pub-res-party-size"
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-res-time">Ngày giờ muốn đặt bàn</Label>
            <Input
              id="pub-res-time"
              type="datetime-local"
              value={reservationTime}
              onChange={(e) => setReservationTime(e.target.value)}
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              Không cần đặt cọc.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-res-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="pub-res-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ví dụ: muốn ngồi ngoài sân vườn, có trẻ nhỏ..."
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt bàn"}
          </Button>
        </form>
      )}
    </div>
  );
}
