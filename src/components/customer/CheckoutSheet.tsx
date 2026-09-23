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
import { createStaffCall } from "@/services/staffCall.service";
import { setOrderPaymentMethod } from "@/services/order.service";
import type { PaymentMethod } from "@/types/database.types";
import { Banknote, QrCode } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  orderId: string | null;
  totalAmount: number;
}

/**
 * Sheet yêu cầu thanh toán: khách chọn tiền mặt hoặc chuyển khoản (hiện mã VietQR),
 * sau đó gửi yêu cầu "checkout" tới nhân viên để thu ngân xác nhận & chốt đơn.
 * Việc xác nhận đã thanh toán (payment_status = paid) do nhân viên thực hiện ở
 * Module thu ngân — khách chỉ có thể khởi tạo yêu cầu.
 */
export function CheckoutSheet({
  open,
  onOpenChange,
  tableId,
  orderId,
  totalAmount,
}: CheckoutSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const qrUrl = orderId ? buildVietQrUrl(totalAmount, orderId.slice(0, 8).toUpperCase()) : null;

  async function handleRequestCheckout() {
    if (!orderId) {
      toast.error("Bạn chưa có đơn hàng nào để thanh toán.");
      return;
    }
    setSubmitting(true);
    try {
      await setOrderPaymentMethod(orderId, method);
      await createStaffCall(tableId, "checkout");
      setRequested(true);
      toast.success("Đã gửi yêu cầu thanh toán, nhân viên sẽ ra hỗ trợ ngay.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu thanh toán.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setRequested(false);
      }}
    >
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Thanh toán</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <p className="text-center text-2xl font-bold text-primary">
            {formatCurrency(totalAmount)}
          </p>

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
              onClick={() => setMethod("transfer")}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                method === "transfer" ? "border-primary bg-primary/5" : ""
              }`}
            >
              <QrCode className="h-6 w-6" />
              <span className="text-sm font-medium">Chuyển khoản</span>
            </button>
          </div>

          {method === "transfer" &&
            (qrUrl ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
                <Image
                  src={qrUrl}
                  alt="Mã VietQR thanh toán"
                  width={220}
                  height={220}
                  unoptimized
                />
                <p className="text-center text-xs text-muted-foreground">
                  Quét mã bằng app ngân hàng bất kỳ để chuyển khoản đúng số tiền.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Quán chưa cấu hình tài khoản nhận VietQR. Vui lòng thanh toán tiền mặt hoặc hỏi
                nhân viên.
              </p>
            ))}
        </div>

        <SheetFooter className="border-t bg-background">
          <Button size="lg" disabled={submitting || requested} onClick={() => void handleRequestCheckout()}>
            {requested ? "Đã gửi yêu cầu — vui lòng đợi nhân viên" : "Yêu cầu thanh toán"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
