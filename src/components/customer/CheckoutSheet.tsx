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
import { playTingSound } from "@/lib/sound";
import { createStaffCall } from "@/services/staffCall.service";
import {
  createPayosPaymentLink,
  getOrderPaymentStatus,
  setOrderPaymentMethod,
} from "@/services/order.service";
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

  function markPaidOnce() {
    setPayosStep((current) => (current === "waiting" ? "paid" : current));
    if (!playedSoundRef.current) {
      playedSoundRef.current = true;
      playTingSound();
    }
  }

  // Đường "NHANH": hasActiveOrder (đến từ `useActiveOrders` ở trang cha) rớt
  // xuống false ngay khi webhook PayOS xác nhận — vì mọi đơn đang hoạt động
  // của bàn LUÔN chuyển status='completed' CÙNG LÚC với payment_status='paid'
  // (cả đường PayOS lẫn đường nhân viên xác nhận thủ công). Chỉ có tác dụng
  // KHI kênh realtime của useActiveOrders thực sự nhận được sự kiện — xem ghi
  // chú "đường CHẮC CHẮN" (polling) ngay dưới để biết vì sao không thể chỉ
  // dựa vào mỗi đường này.
  useEffect(() => {
    if (!open || payosStep !== "waiting" || hasActiveOrder) return;
    markPaidOnce();
  }, [open, payosStep, hasActiveOrder]);

  // Đường "CHẮC CHẮN": polling trực tiếp payment_status của đúng đơn này mỗi
  // 3 giây, KHÔNG phụ thuộc Realtime. Bắt buộc phải có đường này vì: dự án có
  // rất nhiều hook phía chủ quán/nhân viên (`useTables`, `useAnalyticsReport`,
  // `useSmartInsights`, `useDashboardSummary`, `useRevenueSeries`) đều mở 1
  // subscription KHÔNG LỌC trên toàn bộ bảng `orders` — và tablet nhân viên
  // gần như luôn mở liên tục. Theo đúng bug đã biết của Supabase Realtime bản
  // hosted (nhiều subscription cùng bảng, dù filter khác nhau, có thể tranh
  // nhau khiến 1 số bị "câm" không nhận sự kiện —
  // https://github.com/supabase/realtime/issues/1524), kênh của
  // `useActiveOrders` (lọc theo table_id) có thể bị đúng subscription không
  // lọc phía nhân viên "cướp" mất sự kiện bất cứ lúc nào tuỳ thứ tự
  // kết nối — không thể khắc phục triệt để chỉ bằng cách sửa 1 phía. Polling
  // bằng 1 câu SELECT đơn giản đọc thẳng payment_status không đi qua Realtime
  // nên KHÔNG bị ảnh hưởng bởi bug này, đảm bảo màn hình luôn tự chuyển đúng
  // trong tối đa ~3 giây kể cả khi mọi kênh realtime đều im lặng.
  useEffect(() => {
    if (!open || payosStep !== "waiting" || !orderId) return;

    let cancelled = false;
    const interval = setInterval(() => {
      void getOrderPaymentStatus(orderId)
        .then((result) => {
          if (!cancelled && result?.payment_status === "paid") {
            markPaidOnce();
          }
        })
        .catch(() => {
          // Bỏ qua — thử lại ở lượt poll kế tiếp, không làm phiền khách bằng toast lỗi lặp lại mỗi 3 giây.
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, payosStep, orderId]);

  async function handleCreatePayosLink() {
    if (!orderId) {
      toast.error("Bạn chưa có đơn hàng nào để thanh toán.");
      return;
    }
    setPayosStep("creating");
    try {
      // Logic fetch/parse response chuyển sang order.service.createPayosPaymentLink
      // (dùng chung với Màn hình phụ tại quầy, Module 16) — giữ nguyên đúng cách
      // kiểm tra KHẲNG ĐỊNH trên "qrImageUrl" đã sửa ở đó để tránh lặp lại lỗi
      // build TypeScript từng gặp (phủ định trên "error", 1 thuộc tính optional).
      const link = await createPayosPaymentLink(orderId);
      setPayosLink(link);
      setPayosStep("waiting");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể kết nối tới PayOS. Vui lòng thử lại hoặc dùng cách thủ công bên dưới."
      );
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
