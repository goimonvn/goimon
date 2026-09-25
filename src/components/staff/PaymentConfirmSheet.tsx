"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import { buildVietQrUrl } from "@/lib/vietqr";
import { markOrdersPaid } from "@/services/order.service";
import type { TableWithOrders } from "@/types";
import type { PaymentMethod } from "@/types/database.types";
import { Banknote, QrCode } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

interface PaymentConfirmSheetProps {
  table: TableWithOrders | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}

/**
 * Nhân viên xác nhận đã thu tiền cho một bàn: chọn phương thức, xem mã VietQR
 * nếu chuyển khoản, rồi bấm "Xác nhận đã thu tiền" — thao tác này ghi
 * payment_status='paid' cho toàn bộ đơn đang hoạt động của bàn và trả bàn
 * về trạng thái "Trống" (khác với Module 1, nơi khách chỉ có thể YÊU CẦU
 * thanh toán chứ không tự xác nhận được).
 */
export function PaymentConfirmSheet({ table, onOpenChange, onConfirmed }: PaymentConfirmSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);

  const total = table?.activeOrders.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;
  const qrUrl = table ? buildVietQrUrl(total, `BAN ${table.table_number}`) : null;
  // Module 15: có đơn nào của bàn đang chờ khách quét mã VietQR tự động qua
  // PayOS không (payment_order_code đã set nhưng chưa payment_status='paid')
  // — báo cho nhân viên biết TRƯỚC khi bấm "Xác nhận đã thu tiền" bằng tiền
  // mặt, tránh thu trùng nếu khách vừa quét mã xong đúng lúc nhân viên thao
  // tác (2 luồng độc lập, không tự chặn nhau).
  const hasPendingPayosLink = table?.activeOrders.some((o) => o.payment_order_code !== null) ?? false;

  async function handleConfirm() {
    if (!table) return;
    if (table.activeOrders.length === 0) {
      toast.error("Bàn không có đơn hàng nào để xác nhận thanh toán.");
      return;
    }

    setSubmitting(true);
    try {
      const { shiftId } = await markOrdersPaid(
        table.activeOrders.map((o) => o.id),
        table.id,
        method
      );
      toast.success(`Đã xác nhận thanh toán cho Bàn ${table.table_number}.`);
      if (!shiftId) {
        // Không chặn thanh toán — chỉ nhắc nhở để nhân viên bấm "Bắt đầu ca"
        // cho các lượt sau, doanh thu này sẽ không được tính vào báo cáo chốt ca nào.
        toast.warning("Bạn chưa bắt đầu ca làm việc nên đơn này chưa được tính vào ca nào.");
      }
      onConfirmed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xác nhận thanh toán.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={table !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        {table && (
          <>
            <SheetHeader>
              <SheetTitle>Xác nhận thanh toán — Bàn {table.table_number}</SheetTitle>
            </SheetHeader>

            <div className="space-y-4 p-4">
              <p className="text-center text-2xl font-bold text-primary">{formatCurrency(total)}</p>

              {hasPendingPayosLink && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
                  ⏳ Khách đang có mã VietQR tự động (PayOS) chờ quét — màn hình sẽ tự cập nhật nếu
                  khách thanh toán xong, không cần xác nhận tay nữa.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("cash")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                    method === "cash" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <Banknote className="h-6 w-6" />
                  <span className="text-sm font-medium">Tiền mặt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("vietqr")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                    method === "vietqr" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <QrCode className="h-6 w-6" />
                  <span className="text-sm font-medium">Chuyển khoản</span>
                </button>
              </div>

              {method === "vietqr" &&
                (qrUrl ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
                    <Image src={qrUrl} alt="Mã VietQR thanh toán" width={220} height={220} unoptimized />
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Quán chưa cấu hình tài khoản nhận VietQR trong .env.local.
                  </p>
                ))}
            </div>

            <SheetFooter className="border-t bg-background">
              <Button size="lg" disabled={submitting} onClick={() => void handleConfirm()}>
                {submitting ? "Đang xác nhận..." : "Xác nhận đã thu tiền"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
