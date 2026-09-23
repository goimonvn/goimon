"use client";

import { Button } from "@/components/ui/button";
import { CartLineRow } from "@/components/customer/CartLineRow";
import { ComboCartCard } from "@/components/customer/ComboCartCard";
import { type AppliedPromotion, CouponSection } from "@/components/customer/CouponSection";
import { PhoneLookupCard } from "@/components/customer/PhoneLookupCard";
import { TableGate } from "@/components/customer/TableGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/contexts/CartContext";
import { useCustomer } from "@/contexts/CustomerContext";
import { useTable } from "@/contexts/TableContext";
import { formatCurrency } from "@/lib/utils";
import { createOrder } from "@/services/order.service";
import type { CartLine } from "@/types";
import { ShoppingBag, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

/** Gộp danh sách CartLine thành 1 mảng "hiển thị" — mỗi phần tử là 1 dòng lẻ HOẶC 1 nhóm combo (giữ nguyên thứ tự xuất hiện lần đầu). */
function groupCartLines(lines: CartLine[]): ({ kind: "single"; line: CartLine } | { kind: "combo"; groupLines: CartLine[] })[] {
  const result: ({ kind: "single"; line: CartLine } | { kind: "combo"; groupLines: CartLine[] })[] = [];
  const seenGroups = new Set<string>();

  for (const line of lines) {
    if (!line.comboGroupId) {
      result.push({ kind: "single", line });
      continue;
    }
    if (seenGroups.has(line.comboGroupId)) continue;
    seenGroups.add(line.comboGroupId);
    result.push({ kind: "combo", groupLines: lines.filter((l) => l.comboGroupId === line.comboGroupId) });
  }

  return result;
}

function CartPageContent() {
  const router = useRouter();
  const { table } = useTable();
  const { lines, totalAmount, updateQuantity, removeLine, removeComboGroup, clearCart } = useCart();
  const { customer } = useCustomer();
  const [submitting, setSubmitting] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<AppliedPromotion | null>(null);

  const groupedLines = useMemo(() => groupCartLines(lines), [lines]);

  const handleAppliedChange = useCallback((applied: AppliedPromotion | null) => {
    setAppliedPromotion(applied);
  }, []);

  const finalAmount = totalAmount - (appliedPromotion?.discountAmount ?? 0);

  async function handleSubmitOrder() {
    if (!table) return;
    setSubmitting(true);
    try {
      const { discountApplied } = await createOrder({
        tableId: table.id,
        lines,
        customerId: customer?.id ?? null,
        promotionId: appliedPromotion?.promotionId ?? null,
      });
      clearCart();
      if (appliedPromotion && !discountApplied) {
        toast.warning("Mã giảm giá không còn hợp lệ nên đơn được gửi theo giá gốc.");
      }
      toast.success("Đã gửi đơn tới quán, vui lòng chờ trong giây lát!");
      router.push("/order/status");
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
                <ComboCartCard
                  key={entry.groupLines[0].comboGroupId}
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
              {submitting ? "Đang gửi đơn..." : "Gửi đơn cho quán"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <TableGate>
      <CartPageContent />
    </TableGate>
  );
}
