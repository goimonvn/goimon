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
import type { CreatePaymentLinkResult } from "@/types";
import type { PaymentMethod } from "@/types/database.types";
import { Banknote, Loader2, PartyPopper, QrCode, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableNumber: number;
  orderId: string | null;
  totalAmount: number;
  /** true khi bàn còn đơn đang hoạt động (đến từ `useActiveOrders` ở trang cha) — dùng để tự phát hiện thanh toán PayOS thành công, xem ghi chú ở useEffect bên dưới. */
  hasActiveOrder: boolean;
}

/** Trạng thái luồng thanh toán tự động qua PayOS (Module 15) — độc lập với luồng thủ công cũ (setOrderPaymentMethod + gọi nhân viên). */
type PayosStep = "idle" | "creating" | "waiting" | "paid";

/** Phát 1 tiếng "ting" ngắn bằng Web Audio API — KHÔNG dùng file âm thanh (tránh phải thêm asset/dependency mới), an toàn bỏ qua nếu trình duyệt chặn (vd chưa từng có tương tác người dùng). */
function playTingSound(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
    oscillator.frequency.setValueAtTime(1568, ctx.currentTime + 0.12); // G6
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Bỏ qua — hiệu ứng âm thanh chỉ là tiện ích cộng thêm, không được phép gây lỗi màn hình thanh toán.
  }
}

/**
 * Sheet yêu cầu thanh toán — có 2 đường ĐỘC LẬP, khách chọn đường nào cũng được:
 *   1. THỦ CÔNG (cũ): chọn tiền mặt/chuyển khoản, hiện mã VietQR TĨNH, gửi yêu
 *      cầu "checkout" để nhân viên ra xác nhận bằng mắt (PaymentConfirmSheet).
 *   2. TỰ ĐỘNG qua PayOS (Module 15, MỚI): bấm "Thanh toán tự động qua VietQR"
 *      -> tạo 1 mã QR ĐỘNG đúng số tiền hiện tại của bàn -> lắng nghe realtime
 *      trên `orders` của bàn -> TỰ chuyển màn "Thanh toán thành công!" ngay khi
 *      webhook PayOS xác nhận, khách không cần bấm gì thêm, không cần nhân
 *      viên thao tác.
 */
export function CheckoutSheet({
  open,
  onOpenChange,
  tableId,
  tableNumber,
  orderId,
  totalAmount,
  hasActiveOrder,
}: CheckoutSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const [payosStep, setPayosStep] = useState<PayosStep>("idle");
  const [payosLink, setPayosLink] = useState<CreatePaymentLinkResult | null>(null);
  const playedSoundRef = useRef(false);

  const qrUrl = orderId ? buildVietQrUrl(totalAmount, orderId.slice(0, 8).toUpperCase()) : null;

  // Phát hiện thanh toán PayOS THÀNH CÔNG bằng cách theo dõi `hasActiveOrder`
  // (đến từ `useActiveOrders` ở trang cha — hook này ĐÃ có sẵn 1 kênh realtime
  // riêng lắng nghe đúng bàn này để cập nhật danh sách đơn) — KHÔNG tự mở thêm
  // 1 kênh realtime RIÊNG của CheckoutSheet lắng nghe cùng bảng `orders` cùng
  // điều kiện lọc `table_id` như bản đầu tiên đã làm.
  //
  // Lý do đổi cách này: Supabase Realtime (bản hosted) có bug đã biết — khi có
  // từ 2 subscription trở lên cùng lọc TRÙNG NHAU trên cùng 1 bảng (dù tên
  // channel khác nhau), CHỈ 1 trong 2 subscription nhận được sự kiện, cái còn
  // lại im lặng không báo gì (xem https://github.com/supabase/realtime/issues/1524).
  // Đây chính xác là lỗi đã gặp khi test thật: DB cập nhật đúng (bàn tự chuyển
  // "Cần dọn dẹp" nhờ kênh của nhân viên), nhưng kênh riêng của CheckoutSheet
  // (trùng lọc với kênh của useActiveOrders) không nhận được, khiến màn hình
  // khách kẹt mãi ở "Đang chờ xác nhận thanh toán tự động".
  //
  // Mọi đơn đang hoạt động của bàn LUÔN chuyển status='completed' CÙNG LÚC với
  // payment_status='paid' (cả đường PayOS tự động lẫn đường nhân viên xác
  // nhận thủ công — xem confirm_payos_payment/markOrdersPaid) — nên
  // "hasActiveOrder chuyển từ true sang false trong lúc đang chờ" là tín hiệu
  // suy ra thanh toán vừa thành công, đủ chắc chắn mà không cần tự mở kênh
  // riêng. Trường hợp PayOS báo giao dịch THẤT BẠI (code khác "00") không làm
  // hasActiveOrder đổi (đơn vẫn ở trạng thái active để khách thử lại), nên
  // không bị nhầm là thành công.
  useEffect(() => {
    if (!open || payosStep !== "waiting" || hasActiveOrder) return;

    setPayosStep("paid");
    if (!playedSoundRef.current) {
      playedSoundRef.current = true;
      playTingSound();
    }
  }, [open, payosStep, hasActiveOrder]);

  async function handleCreatePayosLink() {
    if (!orderId) {
      toast.error("Bạn chưa có đơn hàng nào để thanh toán.");
      return;
    }
    setPayosStep("creating");
    try {
      const response = await fetch("/api/payments/payos/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = (await response.json().catch(() => null)) as
        | CreatePaymentLinkResult
        | { error?: string }
        | null;

      // Kiểm tra KHẲNG ĐỊNH trên "qrImageUrl" (bắt buộc, chỉ có ở kiểu thành
      // công) thay vì phủ định trên "error" (optional) — vì "error" là thuộc
      // tính optional, TypeScript không thể loại bỏ hẳn nhánh { error?: string }
      // ra khỏi kiểu của body chỉ bằng phủ định, dẫn tới lỗi build
      // "is not assignable to SetStateAction<CreatePaymentLinkResult | null>".
      if (response.ok && body && "qrImageUrl" in body) {
        setPayosLink(body);
        setPayosStep("waiting");
        return;
      }

      toast.error(
        (body && "error" in body && body.error) ||
          "Quán chưa bật thanh toán tự động, vui lòng dùng cách chuyển khoản thủ công bên dưới."
      );
      setPayosStep("idle");
    } catch {
      toast.error("Không thể kết nối tới PayOS. Vui lòng thử lại hoặc dùng cách thủ công bên dưới.");
      setPayosStep("idle");
    }
  }

  async function handleRequestCheckout() {
    if (!orderId) {
      toast.error("Bạn chưa có đơn hàng nào để thanh toán.");
      return;
    }
    setSubmitting(true);
    try {
      await setOrderPaymentMethod(orderId, method);
      await createStaffCall(tableId, "checkout", tableNumber);
      setRequested(true);
      toast.success("Đã gửi yêu cầu thanh toán, nhân viên sẽ ra hỗ trợ ngay.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu thanh toán.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setRequested(false);
      setPayosStep("idle");
      setPayosLink(null);
      playedSoundRef.current = false;
    }
  }

  return (
    <Sheet open={open} onOpenChange={resetAndClose}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Thanh toán</SheetTitle>
        </SheetHeader>

        {payosStep === "paid" ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <PartyPopper className="h-14 w-14 text-primary" />
            <p className="text-xl font-bold">Thanh toán thành công!</p>
            <p className="text-sm text-muted-foreground">
              Cảm ơn quý khách. Hẹn gặp lại quý khách lần sau!
            </p>
            <Button size="lg" className="mt-2 w-full" onClick={() => resetAndClose(false)}>
              Đóng
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-4">
              <p className="text-center text-2xl font-bold text-primary">
                {formatCurrency(totalAmount)}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={payosStep !== "idle"}
                  onClick={() => setMethod("cash")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 disabled:opacity-50 ${
                    method === "cash" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <Banknote className="h-6 w-6" />
                  <span className="text-sm font-medium">Tiền mặt</span>
                </button>
                <button
                  type="button"
                  disabled={payosStep !== "idle"}
                  onClick={() => setMethod("vietqr")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 disabled:opacity-50 ${
                    method === "vietqr" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <QrCode className="h-6 w-6" />
                  <span className="text-sm font-medium">Chuyển khoản</span>
                </button>
              </div>

              {method === "vietqr" && payosStep === "waiting" && payosLink && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <Image
                    src={payosLink.qrImageUrl}
                    alt="Mã VietQR thanh toán tự động"
                    width={240}
                    height={240}
                    unoptimized
                  />
                  <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang chờ xác nhận thanh toán tự động...
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    Quét mã bằng app ngân hàng bất kỳ — màn hình sẽ TỰ chuyển khi nhận được tiền,
                    không cần báo nhân viên.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayosStep("idle");
                      setPayosLink(null);
                    }}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Huỷ, quay lại
                  </button>
                </div>
              )}

              {method === "vietqr" && (payosStep === "idle" || payosStep === "creating") && (
                <>
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={payosStep === "creating"}
                    onClick={() => void handleCreatePayosLink()}
                  >
                    <Zap className="h-4 w-4" />
                    {payosStep === "creating" ? "Đang tạo mã..." : "Thanh toán tự động qua VietQR"}
                  </Button>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    hoặc chuyển khoản thủ công, nhờ nhân viên xác nhận
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {qrUrl ? (
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
                  )}
                </>
              )}
            </div>

            {(payosStep === "idle" || payosStep === "creating") && (
              <SheetFooter className="border-t bg-background">
                <Button
                  size="lg"
                  disabled={submitting || requested || payosStep === "creating"}
                  onClick={() => void handleRequestCheckout()}
                >
                  {requested ? "Đã gửi yêu cầu — vui lòng đợi nhân viên" : "Yêu cầu thanh toán"}
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
