"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { OrderWithItems } from "@/types";
import { Loader2 } from "lucide-react";

interface CounterReviewScreenProps {
  tableNumber: number;
  orders: OrderWithItems[];
  loading: boolean;
}

/**
 * Trạng thái "review" của Màn hình phụ (Module 16) — hiện đúng đơn hàng THẬT
 * của bàn (khách tự đặt qua quét QR, Module 1), KHÔNG có màn hình riêng nào
 * cho thu ngân tự gõ thêm/sửa/xoá món (không tồn tại trong dự án). `orders`
 * đến từ `useActiveOrders(tableId)` ở trang cha nên luôn tự cập nhật realtime
 * ngay khi khách gọi thêm món, không cần thu ngân bấm lại "Hiện lên màn hình
 * phụ" mỗi lần bàn đổi đơn.
 */
export function CounterReviewScreen({ tableNumber, orders, loading }: CounterReviewScreenProps) {
  const items = orders.flatMap((order) => order.order_items);
  const total = orders.reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <div className="flex h-screen w-full flex-col bg-background p-8">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-4xl font-bold">Bàn {tableNumber}</h1>
        <p className="text-lg text-muted-foreground">Đơn hàng của quý khách</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-lg">Đang chờ quý khách gọi món...</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
            >
              <div>
                <p className="text-xl font-medium">
                  {item.quantity}x {item.menu_item?.name ?? "Món"}
                </p>
                {item.notes && <p className="text-sm italic text-muted-foreground">{item.notes}</p>}
                {item.combo_name && (
                  <p className="text-sm text-muted-foreground">Combo: {item.combo_name}</p>
                )}
              </div>
              {item.menu_item && (
                <p className="shrink-0 text-lg font-semibold text-primary">
                  {formatCurrency(item.menu_item.price * item.quantity)}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
        <span className="text-2xl font-medium">Tổng cộng</span>
        <span className="text-3xl font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
