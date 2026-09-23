"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCustomer } from "@/contexts/CustomerContext";
import { getLoyaltyHistory } from "@/services/customer.service";
import { LOYALTY_REASON_LABEL, type LoyaltyHistoryEntry } from "@/types";
import { Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Widget nhỏ hiển thị điểm hiện tại — chỉ hiện khi khách ĐÃ tra cứu/đăng ký
 * thành viên (bước giỏ hàng), đặt ở header trang thực đơn. Bấm để xem lịch sử
 * tích điểm; mỗi lần mở đều gọi `refresh()` để lấy số điểm mới nhất từ server
 * (phòng trường hợp bàn vừa được nhân viên xác nhận thanh toán, cộng điểm
 * xong mà widget đang hiển thị số cũ).
 */
export function LoyaltyWidget() {
  const { customer, refresh } = useCustomer();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<LoyaltyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    let cancelled = false;
    setLoading(true);
    void refresh();
    getLoyaltyHistory(customer.id)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Không thể tải lịch sử tích điểm.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  if (!customer) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary"
      >
        <Gift className="h-4 w-4" />
        {customer.points} điểm
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex max-h-[80dvh] flex-col p-0">
          <SheetHeader>
            <SheetTitle>Điểm thưởng thành viên</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">Số điểm hiện có</p>
              <p className="text-3xl font-bold text-primary">{customer.points}</p>
              <p className="mt-1 text-xs text-muted-foreground">{customer.phone}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Lịch sử tích điểm</p>
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Đang tải...</p>
              ) : history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có lịch sử tích điểm.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                    >
                      <div>
                        <p>{LOYALTY_REASON_LABEL[entry.reason]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                          {entry.orderShortId && ` · Đơn #${entry.orderShortId}`}
                        </p>
                      </div>
                      <span className={`font-bold ${entry.points_change >= 0 ? "text-primary" : "text-destructive"}`}>
                        {entry.points_change >= 0 ? "+" : ""}
                        {entry.points_change}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
