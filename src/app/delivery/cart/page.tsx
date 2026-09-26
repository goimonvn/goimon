"use client";

import { Button } from "@/components/ui/button";
import { CartLineRow } from "@/components/customer/CartLineRow";
import { ComboCartCard } from "@/components/customer/ComboCartCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { DeliveryCartProvider, useDeliveryCart } from "@/contexts/DeliveryCartContext";
import { useDeliverySettings } from "@/hooks/useDeliverySettings";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { groupCartLines } from "@/lib/cart";
import { formatCurrency } from "@/lib/utils";
import { parseDeliveryForm } from "@/lib/validation";
import { calculateShippingFee, createDeliveryOrder } from "@/services/delivery.service";
import { createPayosPaymentLink, getOrderPaymentStatus } from "@/services/order.service";
import type { CreatePaymentLinkResult } from "@/types";
import { Banknote, ChevronLeft, Loader2, ShoppingBag, Zap } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Step = "form" | "payos_waiting";

/**
 * `/delivery/cart` — form thông tin người nhận + tóm tắt đơn + chọn thanh
 * toán cho kênh Giao tận nơi (Module 19). Tách trang riêng khỏi `/order/cart`
 * (Module 1/13) dù cùng khuôn mẫu hiển thị giỏ hàng, vì luồng khác đáng kể:
 * BẮT BUỘC nhập người nhận/địa chỉ (Zod, `deliveryFormSchema`), BẮT BUỘC chọn
 * `payment_method` NGAY lúc gửi đơn (COD hoặc PayOS — không có lựa chọn
 * "thanh toán sau" như dine_in), và nếu chọn PayOS thì HIỆN QR NGAY TẠI TRANG
 * NÀY (dual-path fast/poll giống `CheckoutSheet`, Module 15) trước khi
 * chuyển sang `/delivery/track/[id]`. Từ Module 19 mở rộng, hiển thị các dòng
 * thuộc cùng 1 combo gộp thành `ComboCartCard` (dùng chung `groupCartLines`,
 * xem `lib/cart.ts`) giống hệt `/order/cart`.
 */
function DeliveryCartPageContent() {
  const router = useRouter();
  const { lines, totalAmount, updateQuantity, removeLine, removeComboGroup, clearCart } = useDeliveryCart();
  const groupedLines = useMemo(() => groupCartLines(lines), [lines]);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Module 17/19: mặc định coi như BẬT (`?? true`) trong lúc đang tải/nếu lỗi
  // — không được phép làm khách KHÔNG CÒN cách nào thanh toán chỉ vì 1
  // request cấu hình bị chậm/lỗi, giống hệt CheckoutSheet.
  const { settings: paymentSettings } = usePaymentSettings();
  const { settings: deliverySettings } = useDeliverySettings();
  const payosEnabled = paymentSettings?.enable_payos ?? true;
  const codEnabled = deliverySettings?.enable_cod ?? true;

  const [step, setStep] = useState<Step>("form");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [payosLink, setPayosLink] = useState<CreatePaymentLinkResult | null>(null);
  const paidRef = useRef(false);

  // Tự tính TRƯỚC phí ship để hiển thị ngay trong tóm tắt đơn (không phải chờ
  // tới lúc gửi đơn mới biết) — cùng luật với server (delivery.service.ts#
  // calculateShippingFee), chỉ khác chỗ gọi lại lúc gửi đơn để chắc chắn
  // không lệch nếu admin vừa đổi cấu hình ngay lúc khách đang xem trang.
  useEffect(() => {
    let cancelled = false;
    async function loadFee() {
      try {
        const fee = await calculateShippingFee(totalAmount);
        if (!cancelled) setShippingFee(fee);
      } catch {
        // Bỏ qua — hiển thị "đang tính..." cho tới khi gửi đơn thật (server luôn tính lại), không chặn luồng chính.
      }
    }
    if (totalAmount > 0) void loadFee();
    return () => {
      cancelled = true;
    };
  }, [totalAmount]);

  const grandTotal = totalAmount + (shippingFee ?? 0);

  // Dual-path xác nhận thanh toán PayOS (giống CheckoutSheet, Module 15): kênh
  // Realtime là đường NHANH, polling 3 giây là đường CHẮC CHẮN — xem giải
  // thích đầy đủ về bug Supabase Realtime đã biết ở order.service.ts#getOrderPaymentStatus.
  useEffect(() => {
    if (step !== "payos_waiting" || !createdOrderId) return;

    let cancelled = false;
    const interval = setInterval(() => {
      void getOrderPaymentStatus(createdOrderId)
        .then((result) => {
          if (!cancelled && result?.payment_status === "paid" && !paidRef.current) {
            paidRef.current = true;
            clearCart();
            router.push(`/delivery/track/${createdOrderId}`);
          }
        })
        .catch(() => {
          // Bỏ qua — thử lại ở lượt poll kế tiếp.
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, createdOrderId, clearCart, router]);

  async function handleSubmit(paymentMethod: "cod" | "vietqr") {
    if (lines.length === 0) return;

    const parsed = parseDeliveryForm({ recipientName, recipientPhone, deliveryAddress, deliveryNotes });
    if (!parsed.success) {
      toast.error(parsed.error);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createDeliveryOrder({
        lines,
        recipientName: parsed.data.recipientName,
        recipientPhone: parsed.data.recipientPhone,
        deliveryAddress: parsed.data.deliveryAddress,
        deliveryNotes: parsed.data.deliveryNotes || null,
        paymentMethod,
      });

      if (paymentMethod === "cod") {
        clearCart();
        toast.success("Đã gửi đơn giao hàng — quán sẽ chuẩn bị và giao sớm nhất!");
        router.push(`/delivery/track/${result.orderId}`);
        return;
      }

      // PayOS: giữ nguyên đơn/giỏ hàng cho tới khi thanh toán xong (khách có
      // thể bấm "Huỷ, quay lại" nếu đổi ý — xem CheckoutSheet cùng khuôn mẫu).
      setCreatedOrderId(result.orderId);
      const link = await createPayosPaymentLink(result.orderId);
      setPayosLink(link);
      setStep("payos_waiting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi đơn giao hàng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "payos_waiting" && payosLink) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <Image src={payosLink.qrImageUrl} alt="Mã VietQR thanh toán" width={240} height={240} unoptimized />
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang chờ xác nhận thanh toán...
        </p>
        <p className="text-xs text-muted-foreground">
          Quét mã bằng app ngân hàng bất kỳ — số tiền {formatCurrency(grandTotal)}. Trang sẽ TỰ chuyển khi
          nhận được tiền.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setPayosLink(null);
            setCreatedOrderId(null);
          }}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Huỷ, quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col p-4">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Quay lại" className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Giỏ hàng giao tận nơi</h1>
      </header>

      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10 text-muted-foreground" />}
          title="Giỏ hàng đang trống"
          description="Quay lại thực đơn để chọn món yêu thích nhé."
        />
      ) : (
        <>
          <div className="flex-1 space-y-3">
            {groupedLines.map((entry) =>
              entry.kind === "single" ? (
                <CartLineRow
                  key={entry.line.cartLineId}
                  line={entry.line}
                  onChangeQuantity={updateQuantity}
                  onRemove={removeLine}
                />
              ) : (
                <ComboCartCard key={entry.groupId} groupLines={entry.groupLines} onRemove={removeComboGroup} />
              )
            )}

            <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold">Thông tin giao hàng</p>
              <div className="space-y-1.5">
                <Label htmlFor="del-name">Họ tên người nhận</Label>
                <Input
                  id="del-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ví dụ: Chị Lan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="del-phone">Số điện thoại</Label>
                <Input
                  id="del-phone"
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="del-address">Địa chỉ giao hàng</Label>
                <Textarea
                  id="del-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="del-notes">Ghi chú giao hàng (không bắt buộc)</Label>
                <Textarea
                  id="del-notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  placeholder="Ví dụ: gọi trước khi tới, tầng 3 không thang máy..."
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 mt-4 space-y-3 border-t bg-background pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Tiền món</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Phí giao hàng</span>
              <span>{shippingFee === null ? "Đang tính..." : shippingFee === 0 ? "Miễn phí" : formatCurrency(shippingFee)}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-medium">Tổng cộng</span>
              <span className="font-bold text-primary">{formatCurrency(grandTotal)}</span>
            </div>

            {!payosEnabled && !codEnabled ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Quán chưa bật phương thức thanh toán nào cho kênh giao hàng. Vui lòng liên hệ trực tiếp để đặt hàng.
              </p>
            ) : (
              <div className={`grid gap-3 ${payosEnabled && codEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                {payosEnabled && (
                  <Button
                    size="lg"
                    variant="default"
                    disabled={submitting}
                    onClick={() => void handleSubmit("vietqr")}
                  >
                    <Zap className="h-4 w-4" />
                    Thanh toán qua VietQR
                  </Button>
                )}
                {codEnabled && (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => void handleSubmit("cod")}
                  >
                    <Banknote className="h-4 w-4" />
                    {submitting ? "Đang gửi..." : "Thanh toán khi nhận"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DeliveryCartPage() {
  return (
    <DeliveryCartProvider>
      <DeliveryCartPageContent />
    </DeliveryCartProvider>
  );
}
