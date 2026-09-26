"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeliveryOrders } from "@/hooks/useDeliveryOrders";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCurrency } from "@/lib/utils";
import { updateDeliveryStatus } from "@/services/delivery.service";
import {
  DELIVERY_ADVANCE_ACTION_LABEL,
  DELIVERY_STATUS_LABEL,
  NEXT_DELIVERY_STATUS,
  type OrderWithItems,
} from "@/types";
import type { DeliveryStatus } from "@/types/database.types";
import { Bike, MapPin, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

function statusBadgeVariant(status: DeliveryStatus): "warning" | "secondary" | "default" | "success" {
  switch (status) {
    case "pending":
      return "warning";
    case "preparing":
      return "secondary";
    case "delivering":
      return "default";
    case "completed":
      return "success";
    default:
      return "secondary";
  }
}

/**
 * `/staff/orders` — quản lý đơn Giao tận nơi (Module 19), tách riêng khỏi
 * `/staff/tables` (đơn tại bàn) và KDS (`/staff/kds`, chỉ thấy TỪNG MÓN, không
 * thấy người nhận/địa chỉ) vì nhân viên giao hàng cần đúng những thông tin
 * này để thao tác. Nút chuyển bước CHỈ đổi `delivery_status` (KHÔNG đụng
 * `status`/KDS) — món trong đơn vẫn phải được bếp xử lý riêng ở
 * `/staff/kds` như bình thường (đơn delivery cũng lên KDS y hệt đơn mang đi,
 * chỉ khác nhãn "🛵 Giao hàng", xem KdsItemCard.tsx). Từ Module 19 mở rộng,
 * nút "+ Tạo đơn giao hàng" ở header mở `/staff/orders/new` — cho phép nhân
 * viên tạo đơn THAY khách khi khách gọi điện đặt mua qua điện thoại (xem
 * `delivery.service.ts#createStaffDeliveryOrder`); đơn mới tạo tự xuất hiện
 * ngay ở danh sách dưới đây qua `useDeliveryOrders` (realtime), không cần
 * làm mới trang.
 */
export default function StaffOrdersPage() {
  usePageTitle("Đơn giao hàng");
  const { orders, loading } = useDeliveryOrders();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdvance(order: OrderWithItems) {
    const nextStatus = NEXT_DELIVERY_STATUS[order.delivery_status];
    if (!nextStatus) return;

    setBusyId(order.id);
    try {
      await updateDeliveryStatus(order.id, nextStatus);
      toast.success(`Đã chuyển đơn #${order.id.slice(0, 8).toUpperCase()} sang "${DELIVERY_STATUS_LABEL[nextStatus]}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái giao hàng.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Đơn giao hàng ({orders.length})</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/staff/orders/new">
            <Plus className="h-4 w-4" />
            Tạo đơn giao hàng
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Không có đơn giao hàng nào đang xử lý.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const busy = busyId === order.id;
            const nextStatus = NEXT_DELIVERY_STATUS[order.delivery_status];
            const grandTotal = order.total_amount + order.shipping_fee;

            return (
              <div key={order.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.recipient_name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {order.recipient_phone}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(order.delivery_status)}>
                    {DELIVERY_STATUS_LABEL[order.delivery_status]}
                  </Badge>
                </div>

                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {order.delivery_address}
                </p>

                {order.delivery_notes && (
                  <p className="rounded-lg bg-muted/60 p-2 text-xs italic text-muted-foreground">
                    {order.delivery_notes}
                  </p>
                )}

                <div className="space-y-1 border-t pt-2 text-sm">
                  {order.order_items.map((item) => (
                    <p key={item.id}>
                      {item.quantity}x {item.menu_item?.name ?? "Món"}
                    </p>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">
                    {order.payment_method === "cod" ? "Thu hộ (COD)" : "Đã trả qua VietQR"}
                  </span>
                  <span className="font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>

                {nextStatus && (
                  <Button size="sm" className="w-full" disabled={busy} onClick={() => void handleAdvance(order)}>
                    {DELIVERY_ADVANCE_ACTION_LABEL[order.delivery_status]}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
