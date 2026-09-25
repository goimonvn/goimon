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
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
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
 * Nhân viên xác nhận đã thu tiền cho một bàn: chìa mã VietQR TĨNH có sẵn cho
 * khách quét trực tiếp tại bàn (nếu quán còn bật), rồi bấm ĐÚNG 1 trong 2 nút
 * "Xác nhận đã nhận Tiền mặt"/"Xác nhận đã nhận Chuyển khoản" tương ứng với
 * cách khách vừa trả tiền (Module 17 — thay cho cặp "chọn phương thức + 1 nút
 * xác nhận chung" ở bản cũ, rõ ràng hơn cho nhân viên thao tác nhanh tại
 * quầy). Bấm xong ghi payment_status='paid' cho toàn bộ đơn đang hoạt động
 * của bàn và trả bàn về "Cần dọn dẹp" (khác với Module 1, nơi khách chỉ có
 * thể YÊU CẦU thanh toán chứ không tự xác nhận được).
 */
export function PaymentConfirmSheet({ table, onOpenChange, onConfirmed }: PaymentConfirmSheetProps) {
  const [submittingMethod, setSubmittingMethod] = useState<PaymentMethod | null>(null);

  // Module 17: cấu hình bật/tắt phương thức — fail-open (`?? true`) khi đang
  // tải/lỗi, và NẾU quán tắt CẢ 2 (cash + static QR, cấu hình bất thường) vẫn
  // hiện đủ cả 2 nút thay vì để nhân viên hoàn toàn không có cách nào xác
  // nhận thanh toán — "tiền đã thu là sự thật quan trọng nhất" (triết lý nhất
  // quán xuyên suốt dự án, xem markOrdersPaid).
  const { settings: paymentSettings } = usePaymentSettings();
  const cashEnabledRaw = paymentSettings?.enable_cash ?? true;
  const staticQrEnabledRaw = paymentSettings?.enable_static_qr ?? true;
  const cashEnabled = cashEnabledRaw || !staticQrEnabledRaw;
  const staticQrEnabled = staticQrEnabledRaw || !cashEnabledRaw;

  const total = table?.activeOrders.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;
  const qrUrl = table ? buildVietQrUrl(total, `BAN ${table.table_number}`) : null;
  // Module 15: có đơn nào của bàn đang chờ khách quét mã VietQR tự động qua
  // PayOS không (payment_order_code đã set nhưng chưa payment_status='paid')
  // — báo cho nhân viên biết TRƯỚC khi bấm xác nhận thủ công, tránh thu trùng
  // nếu khách vừa quét mã xong đúng lúc nhân viên thao tác (2 luồng độc lập,
  // không tự chặn nhau).
  const hasPendingPayosLink = table?.activeOrders.some((o) => o.payment_order_code !== null) ?? false;

  async function handleConfirm(method: PaymentMethod) {
    if (!table) return;
    if (table.activeOrders.length === 0) {
      toast.error("Bàn không có đơn hàng nào để xác nhận thanh toán.");
      return;
    }

    setSubmittingMethod(method);
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
      setSubmittingMethod(null);
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

              {/*
                Module 17: mã VietQR TĨNH giờ LUÔN hiện sẵn (nếu quán còn bật
                "Mã VietQR Cố định") để nhân viên chìa điện thoại/máy tính bảng
                cho khách quét ngay tại bàn — không còn phải bấm chọn "Chuyển
                khoản" trước mới thấy mã như bản cũ (khách đứng chờ, nhân viên
                cần thao tác nhanh nhất có thể).
              */}
              {staticQrEnabled &&
                (qrUrl ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
                    <Image src={qrUrl} alt="Mã VietQR thanh toán" width={220} height={220} unoptimized />
                    <p className="text-center text-xs text-muted-foreground">
                      Chìa mã này cho khách quét, sau đó bấm &quot;Xác nhận đã nhận Chuyển khoản&quot; bên dưới.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Quán chưa cấu hình tài khoản nhận VietQR trong .env.local.
                  </p>
                ))}
            </div>

            <SheetFooter className="border-t bg-background">
              {/*
                Layout dọc (icon trên, chữ dưới, tự xuống dòng) thay vì hàng
                ngang mặc định của Button — cùng cách đã sửa cho nút "Thanh
                toán màn hình phụ" (Module 16): nhãn "Xác nhận đã nhận Chuyển
                khoản" quá dài để nằm vừa 1 hàng ở khung 2 cột trên điện thoại
                nhỏ nếu giữ nguyên `whitespace-nowrap`/chiều cao cố định mặc
                định của Button.
              */}
              <div className={`grid gap-2 ${cashEnabled && staticQrEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                {cashEnabled && (
                  <Button
                    variant="outline"
                    disabled={submittingMethod !== null}
                    onClick={() => void handleConfirm("cash")}
                    className="h-auto min-h-12 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-sm leading-tight"
                  >
                    <Banknote className="h-4 w-4 shrink-0" />
                    <span>{submittingMethod === "cash" ? "Đang xác nhận..." : "Xác nhận đã nhận Tiền mặt"}</span>
                  </Button>
                )}
                {staticQrEnabled && (
                  <Button
                    disabled={submittingMethod !== null}
                    onClick={() => void handleConfirm("vietqr")}
                    className="h-auto min-h-12 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-sm leading-tight"
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>{submittingMethod === "vietqr" ? "Đang xác nhận..." : "Xác nhận đã nhận Chuyển khoản"}</span>
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
