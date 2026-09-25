"use client";

import { Button } from "@/components/ui/button";
import { CheckoutSheet } from "@/components/customer/CheckoutSheet";
import { FeedbackForm } from "@/components/customer/FeedbackForm";
import { OrderStatusCard } from "@/components/customer/OrderStatusCard";
import { StaffCallButtons } from "@/components/customer/StaffCallButtons";
import { TableGate } from "@/components/customer/TableGate";
import { VatInvoiceDialog } from "@/components/customer/VatInvoiceDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTable } from "@/contexts/TableContext";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { formatCurrency } from "@/lib/utils";
import { getFeedbackForOrder } from "@/services/feedback.service";
import { getLatestCompletedOrder } from "@/services/order.service";
import { ChevronLeft, FileText, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** Trạng thái màn hình "sau khi hết đơn đang hoạt động" — quyết định hiện form đánh giá hay ô trống mặc định. */
type PostOrderState = "idle" | "checking" | "show-feedback" | "feedback-submitted" | "no-order";

function StatusPageContent() {
  const router = useRouter();
  const { table } = useTable();
  const { orders, loading } = useActiveOrders(table?.id ?? null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [vatOpen, setVatOpen] = useState(false);
  const [postOrderState, setPostOrderState] = useState<PostOrderState>("idle");
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);

  const grandTotal = useMemo(
    () => orders.reduce((sum, order) => sum + order.total_amount, 0),
    [orders]
  );
  // Thanh toán/xuất VAT áp dụng cho đơn hàng gần nhất của bàn.
  const latestOrderId = orders.at(-1)?.id ?? null;

  /**
   * Khi bàn không còn đơn đang hoạt động (đã thanh toán xong, hoặc chưa từng
   * gọi món), kiểm tra xem có đơn vừa hoàn tất chưa được đánh giá không — nếu
   * có, chuyển màn hình sang form đánh giá nhanh (yêu cầu của Module 5).
   */
  useEffect(() => {
    const tableId = table?.id;
    if (loading || !tableId) return;
    if (orders.length > 0) {
      setPostOrderState("idle");
      return;
    }

    let cancelled = false;
    setPostOrderState("checking");

    async function check(id: string) {
      try {
        const completedOrder = await getLatestCompletedOrder(id);
        if (cancelled) return;
        if (!completedOrder) {
          setPostOrderState("no-order");
          return;
        }
        const existingFeedback = await getFeedbackForOrder(completedOrder.id);
        if (cancelled) return;
        if (existingFeedback) {
          setPostOrderState("feedback-submitted");
          return;
        }
        setFeedbackOrderId(completedOrder.id);
        setPostOrderState("show-feedback");
      } catch {
        if (!cancelled) setPostOrderState("no-order");
      }
    }

    void check(tableId);
    return () => {
      cancelled = true;
    };
  }, [loading, orders.length, table?.id]);

  if (!table) return null;

  return (
    <div className="min-h-dvh p-4 pb-28">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Quay lại" className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Đơn hàng — Bàn {table.table_number}</h1>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderStatusCard key={order.id} order={order} />
          ))}
        </div>
      ) : postOrderState === "show-feedback" && feedbackOrderId ? (
        <FeedbackForm
          orderId={feedbackOrderId}
          tableNumber={table.table_number}
          onSubmitted={() => setPostOrderState("feedback-submitted")}
        />
      ) : postOrderState === "feedback-submitted" ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-lg font-bold">Cảm ơn quý khách!</p>
          <p className="mt-1 text-sm text-muted-foreground">Đánh giá của bạn đã được ghi nhận.</p>
        </div>
      ) : postOrderState === "checking" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <EmptyState
          icon={<ReceiptText className="h-10 w-10 text-muted-foreground" />}
          title="Chưa có đơn hàng nào đang xử lý"
          description="Hãy quay lại thực đơn để gọi món."
        />
      )}

      {postOrderState !== "show-feedback" && postOrderState !== "feedback-submitted" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">Cần hỗ trợ?</p>
          <StaffCallButtons tableId={table.id} tableNumber={table.table_number} />
        </div>
      )}

      {orders.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md space-y-2 border-t bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tổng tạm tính</span>
            <span className="font-bold text-primary">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setVatOpen(true)}>
              <FileText className="h-4 w-4" />
              Xuất hoá đơn VAT
            </Button>
            <Button onClick={() => setCheckoutOpen(true)}>Thanh toán</Button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/order" className="text-sm text-primary underline underline-offset-4">
          Gọi thêm món
        </Link>
      </div>

      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        tableId={table.id}
        tableNumber={table.table_number}
        orderId={latestOrderId}
        totalAmount={grandTotal}
        hasActiveOrder={orders.length > 0}
      />
      <VatInvoiceDialog open={vatOpen} onOpenChange={setVatOpen} orderId={latestOrderId} />
    </div>
  );
}

export default function StatusPage() {
  return (
    <TableGate>
      <StatusPageContent />
    </TableGate>
  );
}
