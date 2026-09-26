"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCurrency } from "@/lib/utils";
import {
  getDeliveryTrackingInfo,
  subscribeToOneOrderChanges,
} from "@/services/delivery.service";
import { notifyDeliverySupportRequestTelegram } from "@/services/telegram.service";
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_STEPS, type DeliveryTrackingInfo } from "@/types";
import { Bike, Check, MapPin, Phone, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * `/delivery/track/[id]` — theo dõi realtime 1 đơn giao hàng (Module 19),
 * công khai (không đăng nhập, giống `/order/status`) — khách vào lại bằng
 * link này (lưu ở lịch sử trình duyệt/được chuyển tới ngay sau khi gửi đơn)
 * để xem tiến độ mà không cần tài khoản nào.
 *
 * DUAL-PATH giống `CheckoutSheet`/`getOrderPaymentStatus` (Module 15): kênh
 * Realtime (`subscribeToOneOrderChanges`) là đường NHANH, polling mỗi 5 giây
 * là đường CHẮC CHẮN — xem giải thích đầy đủ về bug Supabase Realtime đã biết
 * (nhiều subscription cùng bảng `orders` có thể "cướp" sự kiện của nhau) ở
 * order.service.ts#getOrderPaymentStatus. Đơn giao hàng đặc biệt dễ gặp tình
 * huống này vì khách thường mở trang tracking rất lâu (chờ giao hàng có thể
 * vài chục phút), càng cần đường polling để không bị "kẹt" trạng thái cũ.
 */
export default function DeliveryTrackPage() {
  usePageTitle("Theo dõi đơn giao hàng");
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [info, setInfo] = useState<DeliveryTrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [supportRequested, setSupportRequested] = useState(false);

  async function load() {
    try {
      const data = await getDeliveryTrackingInfo(orderId);
      if (!data) {
        setNotFound(true);
        return;
      }
      setInfo(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải thông tin đơn hàng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const channel = subscribeToOneOrderChanges(orderId, () => void load());
    const interval = setInterval(() => void load(), 5000);

    return () => {
      void channel.unsubscribe();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function handleSupportRequest() {
    if (!info) return;
    notifyDeliverySupportRequestTelegram(orderId, info.order.recipient_phone ?? "");
    setSupportRequested(true);
    toast.success("Đã gửi yêu cầu hỗ trợ, quán sẽ liên hệ lại sớm nhất.");
  }

  if (loading) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-md space-y-4 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-md p-4">
        <EmptyState
          icon={<Bike className="h-10 w-10 text-muted-foreground" />}
          title="Không tìm thấy đơn hàng"
          description="Đường dẫn có thể không đúng hoặc đơn đã bị xoá."
        />
      </div>
    );
  }

  const { order, grandTotal } = info;
  const status = order.delivery_status;
  const currentStepIndex = DELIVERY_STATUS_STEPS.indexOf(status);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Theo dõi đơn giao hàng</h1>
        <p className="text-xs text-muted-foreground">Mã đơn: #{order.id.slice(0, 8).toUpperCase()}</p>
      </header>

      {status === "cancelled" ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold text-destructive">Đơn hàng đã bị huỷ</p>
          <p className="text-sm text-muted-foreground">Vui lòng liên hệ quán nếu có thắc mắc.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            {DELIVERY_STATUS_STEPS.map((step, index) => {
              const done = index <= currentStepIndex;
              return (
                <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full items-center">
                    <div className="h-0.5 flex-1 bg-border" style={{ visibility: index === 0 ? "hidden" : "visible" }} />
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div
                      className="h-0.5 flex-1 bg-border"
                      style={{ visibility: index === DELIVERY_STATUS_STEPS.length - 1 ? "hidden" : "visible" }}
                    />
                  </div>
                  <span className={`text-center text-[11px] leading-tight ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {DELIVERY_STATUS_LABEL[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{order.recipient_name}</p>
          <Badge variant={order.payment_status === "paid" ? "success" : "warning"}>
            {order.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
          </Badge>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          {order.recipient_phone}
        </p>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {order.delivery_address}
        </p>
        {order.delivery_notes && (
          <p className="rounded-lg bg-muted/60 p-2 text-xs italic text-muted-foreground">{order.delivery_notes}</p>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">Chi tiết đơn hàng</p>
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantity}x {item.menu_item?.name ?? "Món"}
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 text-sm text-muted-foreground">
          <span>Tiền món</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Phí ship</span>
          <span>{order.shipping_fee === 0 ? "Miễn phí" : formatCurrency(order.shipping_fee)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-primary">
          <span>Tổng cộng</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" disabled={supportRequested} onClick={handleSupportRequest}>
        {supportRequested ? "Đã gửi yêu cầu hỗ trợ" : "Liên hệ hỗ trợ"}
      </Button>
    </div>
  );
}
