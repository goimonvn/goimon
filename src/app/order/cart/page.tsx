"use client";

import { Button } from "@/components/ui/button";
import { CartLineRow } from "@/components/customer/CartLineRow";
import { ComboCartCard } from "@/components/customer/ComboCartCard";
import { type AppliedPromotion, CouponSection } from "@/components/customer/CouponSection";
import { PhoneLookupCard } from "@/components/customer/PhoneLookupCard";
import { TableGate } from "@/components/customer/TableGate";
import { TakeawaySection } from "@/components/customer/TakeawaySection";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/contexts/CartContext";
import { useCustomer } from "@/contexts/CustomerContext";
import { useTable } from "@/contexts/TableContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { groupCartLines } from "@/lib/cart";
import { formatCurrency } from "@/lib/utils";
import { createOrder } from "@/services/order.service";
import type { OrderType } from "@/types/database.types";
import { ShoppingBag, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

function CartPageContent() {
  const router = useRouter();
  const { table } = useTable();
  const { lines, totalAmount, updateQuantity, removeLine, removeComboGroup, clearCart } = useCart();
  const { customer } = useCustomer();
  const [submitting, setSubmitting] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<AppliedPromotion | null>(null);

  // Module 13: đặt mang đi — xem TakeawaySection.tsx và
  // order.service.ts#createOrder cho quyết định thiết kế đầy đủ.
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  // Xác nhận đơn mang đi hiển thị NGAY TẠI TRANG NÀY thay vì chuyển sang
  // /order/status — trang đó lọc đơn theo table.id nên sẽ không bao giờ thấy
  // đơn mang đi (table_id = null).
  const [takeawayConfirmation, setTakeawayConfirmation] = useState<{
    customerName: string;
    pickupTime: string | null;
  } | null>(null);

  const groupedLines = useMemo(() => groupCartLines(lines), [lines]);

  const handleAppliedChange = useCallback((applied: AppliedPromotion | null) => {
    setAppliedPromotion(applied);
  }, []);

  const finalAmount = totalAmount - (appliedPromotion?.discountAmount ?? 0);

  async function handleSubmitOrder() {
    if (!table) return;
    const isTakeaway = orderType === "takeaway";
    if (isTakeaway && (!customerName.trim() || !customerPhone.trim())) {
      toast.error("Vui lòng nhập tên và số điện thoại cho đơn mang đi.");
      return;
    }

    setSubmitting(true);
    try {
      const isoPickupTime = pickupTime ? new Date(pickupTime).toISOString() : null;
      const { discountApplied } = await createOrder({
        tableId: isTakeaway ? null : table.id,
        lines,
        customerId: customer?.id ?? null,
        promotionId: appliedPromotion?.promotionId ?? null,
        orderType,
        customerName: isTakeaway ? customerName.trim() : null,
        customerPhone: isTakeaway ? customerPhone.trim() : null,
        pickupTime: isTakeaway ? isoPickupTime : null,
      });
      clearCart();
      if (appliedPromotion && !discountApplied) {
        toast.warning("Mã giảm giá không còn hợp lệ nên đơn được gửi theo giá gốc.");
      }
      if (isTakeaway) {
        setTakeawayConfirmation({ customerName: customerName.trim(), pickupTime: isoPickupTime });
        toast.success("Đã gửi đơn mang đi tới quán!");
      } else {
        toast.success("Đã gửi đơn tới quán, vui lòng chờ trong giây lát!");
        router.push("/order/status");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi đơn thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col p-4">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Quay lại" className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Giỏ hàng của bạn</h1>
      </header>

      {takeawayConfirmation ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
          title="Đã gửi đơn mang đi!"
          description={
            `Cảm ơn ${takeawayConfirmation.customerName}, quán đang chuẩn bị đơn của bạn. ` +
            (takeawayConfirmation.pickupTime
              ? `Hẹn lấy lúc ${new Date(takeawayConfirmation.pickupTime).toLocaleString("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}.`
              : "Quán sẽ liên hệ khi đơn sẵn sàng.")
          }
        />
      ) : lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10 text-muted-foreground" />}
          title="Giỏ hàng đang trống"
          description="Quay lại thực đơn để chọn món yêu thích nhé."
        />
      ) : (
        <>
          <div className="flex-1 space-y-3">
            <TakeawaySection
              orderType={orderType}
              onOrderTypeChange={setOrderType}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              customerPhone={customerPhone}
              onCustomerPhoneChange={setCustomerPhone}
              pickupTime={pickupTime}
              onPickupTimeChange={setPickupTime}
            />
            {groupedLines.map((entry) =>
              entry.kind === "single" ? (
                <CartLineRow
                  key={entry.line.cartLineId}
                  line={entry.line}
                  onChangeQuantity={updateQuantity}
                  onRemove={removeLine}
                />
              ) : (
                <ComboCartCard
                  key={entry.groupId}
                  groupLines={entry.groupLines}
                  onRemove={removeComboGroup}
                />
              )
            )}
            <PhoneLookupCard />
            <CouponSection subtotal={totalAmount} onAppliedChange={handleAppliedChange} />
          </div>

          <div className="sticky bottom-0 mt-4 space-y-3 border-t bg-background pt-4">
            {appliedPromotion && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Giảm giá</span>
                <span className="font-medium text-primary">-{formatCurrency(appliedPromotion.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base">
              <span className="font-medium">Tổng cộng</span>
              <span className="font-bold text-primary">{formatCurrency(finalAmount)}</span>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={() => void handleSubmitOrder()}
            >
              {submitting
                ? "Đang gửi đơn..."
                : orderType === "takeaway"
                  ? "Gửi đơn mang đi"
                  : "Gửi đơn cho quán"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  usePageTitle("Giỏ hàng của bạn");
  return (
    <TableGate>
      <CartPageContent />
    </TableGate>
  );
}
