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
import { groupCartLines, STAFF_DELIVERY_CART_STORAGE_KEY } from "@/lib/cart";
import { formatCurrency } from "@/lib/utils";
import { parseDeliveryForm } from "@/lib/validation";
import { calculateShippingFee, createStaffDeliveryOrder } from "@/services/delivery.service";
import { Banknote, CheckCircle2, ChevronLeft, ShoppingBag, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * `/staff/orders/new/cart` — bước 2 (thông tin người nhận + xác nhận) của
 * luồng "Tạo đơn giao hàng" cho nhân viên (Module 19 mở rộng). Tách RIÊNG
 * khỏi `/delivery/cart` (dù cùng hiển thị giỏ hàng/form người nhận) vì luồng
 * thanh toán khác hẳn: khách gọi điện KHÔNG tự quét mã PayOS được, nên ở đây
 * KHÔNG có bước "hiện QR chờ webhook" — nhân viên chỉ chọn 1 trong 2 trạng
 * thái XÁC NHẬN NGAY lúc tạo đơn (COD hoặc "đã chuyển khoản trước", xem
 * `delivery.service.ts#createStaffDeliveryOrder`). Sau khi tạo đơn thành
 * công, quay lại `/staff/orders` (đơn mới xuất hiện ngay ở đó qua realtime)
 * thay vì `/delivery/track/[id]` — nhân viên đang đứng ở khu vực quản lý đơn,
 * không cần xem trang theo dõi dành cho khách.
 */
function StaffNewDeliveryCartPageContent() {
  const router = useRouter();
  const { lines, totalAmount, updateQuantity, removeLine, removeComboGroup, clearCart } = useDeliveryCart();
  const groupedLines = useMemo(() => groupCartLines(lines), [lines]);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdConfirmation, setCreatedConfirmation] = useState<{ recipientName: string } | null>(null);

  const { settings: deliverySettings } = useDeliverySettings();
  const codEnabled = deliverySettings?.enable_cod ?? true;

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

  async function handleSubmit(paymentMethod: "cod" | "paid") {
    if (lines.length === 0) return;

    const parsed = parseDeliveryForm({ recipientName, recipientPhone, deliveryAddress, deliveryNotes });
    if (!parsed.success) {
      toast.error(parsed.error);
      return;
    }

    setSubmitting(true);
    try {
      await createStaffDeliveryOrder({
        lines,
        recipientName: parsed.data.recipientName,
        recipientPhone: parsed.data.recipientPhone,
        deliveryAddress: parsed.data.deliveryAddress,
        deliveryNotes: parsed.data.deliveryNotes || null,
        paymentMethod,
      });
      clearCart();
      setCreatedConfirmation({ recipientName: parsed.data.recipientName });
      toast.success("Đã tạo đơn giao hàng.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo đơn giao hàng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdConfirmation) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
          title="Đã tạo đơn giao hàng!"
          description={`Đơn của ${createdConfirmation.recipientName} đã xuất hiện trong danh sách "Đơn giao hàng".`}
        />
        <Button onClick={() => router.push("/staff/orders")}>Về danh sách đơn giao hàng</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col p-4">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Quay lại" className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Tạo đơn giao hàng</h1>
      </header>

      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10 text-muted-foreground" />}
          title="Chưa chọn món nào"
          description="Quay lại chọn món cho khách trước khi tạo đơn."
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
                <Label htmlFor="staff-del-name">Họ tên người nhận</Label>
                <Input
                  id="staff-del-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ví dụ: Chị Lan"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-del-phone">Số điện thoại</Label>
                <Input
                  id="staff-del-phone"
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-del-address">Địa chỉ giao hàng</Label>
                <Textarea
                  id="staff-del-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-del-notes">Ghi chú giao hàng (không bắt buộc)</Label>
                <Textarea
                  id="staff-del-notes"
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

            <div className={`grid gap-3 ${codEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
              {codEnabled && (
                <Button
                  size="lg"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void handleSubmit("cod")}
                  className="h-auto min-h-11 flex-col gap-1 whitespace-normal py-2 text-xs"
                >
                  <Banknote className="h-4 w-4" />
                  Thu hộ khi giao (COD)
                </Button>
              )}
              <Button
                size="lg"
                variant="default"
                disabled={submitting}
                onClick={() => void handleSubmit("paid")}
                className="h-auto min-h-11 flex-col gap-1 whitespace-normal py-2 text-xs"
              >
                <Wallet className="h-4 w-4" />
                {submitting ? "Đang tạo đơn..." : "Khách đã chuyển khoản trước"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StaffNewDeliveryCartRoute() {
  return (
    <DeliveryCartProvider storageKey={STAFF_DELIVERY_CART_STORAGE_KEY}>
      <StaffNewDeliveryCartPageContent />
    </DeliveryCartProvider>
  );
}
