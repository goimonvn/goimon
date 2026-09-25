"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { TABLE_STATUS_LABEL, type TableWithOrders } from "@/types";
import { Bell, CalendarClock, Circle, RectangleHorizontal, Smartphone, Square, Sparkles } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

interface TableCardProps {
  table: TableWithOrders;
  onClick: () => void;
  /**
   * "Gọi món hộ" (Module 12) — CHỈ hiển thị khi cha truyền prop này (staff/tables),
   * KHÔNG hiển thị ở lưới bàn thu gọn trên /admin/dashboard (cha không truyền)
   * để không làm rối 1 màn hình vốn chỉ để xem tổng quan.
   */
  onOrderForCustomer?: (table: TableWithOrders) => void;
  /**
   * "Bàn dọn dẹp" -> "Bàn trống" (Module 13) — nhân viên bấm 1 chạm để xác
   * nhận đã dọn xong, KHÔNG cần mở chi tiết bàn ra xem. Chỉ hiển thị khi cha
   * truyền prop này VÀ bàn đang ở trạng thái `needs_cleaning`.
   */
  onMarkCleaned?: (table: TableWithOrders) => void;
}

/** Module 13: 4 trạng thái bàn — xem vòng đời đầy đủ ở JSDoc TABLE_STATUS_LABEL (types/index.ts). */
const STATUS_STYLE: Record<TableWithOrders["status"], string> = {
  available: "border-emerald-400 bg-emerald-50",
  occupied: "border-destructive bg-destructive/10",
  payment_pending: "border-amber-400 bg-amber-50",
  needs_cleaning: "border-slate-400 bg-slate-100",
};

const STATUS_BADGE_VARIANT: Record<TableWithOrders["status"], BadgeProps["variant"]> = {
  available: "success",
  occupied: "destructive",
  payment_pending: "warning",
  needs_cleaning: "secondary",
};

const SHAPE_ICON: Record<TableWithOrders["shape"], typeof Square> = {
  square: Square,
  round: Circle,
  rectangle: RectangleHorizontal,
};

/**
 * Cả thẻ là 1 vùng bấm được (mở chi tiết bàn) — dùng `div role="button"` thay
 * vì thẻ `<button>` gốc trước đây (Module 12) vì nút "Gọi món hộ" bên trong
 * CŨNG là 1 `<button>` thật: HTML không cho phép lồng `<button>` trong
 * `<button>` (trình duyệt sẽ tự "thoát" ra ngoài, phá vỡ layout/sự kiện click).
 * `role="button"` + `tabIndex`/`onKeyDown` giữ nguyên khả năng thao tác bằng
 * bàn phím mà thẻ `<button>` gốc vốn có sẵn.
 */
export function TableCard({ table, onClick, onOrderForCustomer, onMarkCleaned }: TableCardProps) {
  const total = table.activeOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const itemCount = table.activeOrders.reduce(
    (sum, order) => sum + order.order_items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const hasPendingCall = table.pendingStaffCalls.length > 0;
  const ShapeIcon = SHAPE_ICON[table.shape];

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  function handleOrderForCustomerClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onOrderForCustomer?.(table);
  }

  function handleMarkCleanedClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onMarkCleaned?.(table);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex h-full flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-transform active:scale-[0.97]",
        STATUS_STYLE[table.status]
      )}
    >
      {hasPendingCall && (
        <span className="absolute -right-2 -top-2 flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
          <Bell className="h-3.5 w-3.5" />
        </span>
      )}

      {/*
       * Nhóm riêng phần nội dung phía trên (tên bàn/trạng thái/đơn/cảnh báo)
       * khỏi nút "Gọi món hộ" — các bàn có nội dung dài/ngắn khác nhau (vd bàn
       * đang có đơn + cảnh báo vs bàn trống) nên nếu để nút trôi theo flow
       * bình thường, nó sẽ nằm ở độ cao KHÁC NHAU giữa các thẻ cùng hàng (thẻ
       * lưới luôn cao bằng nhau do CSS Grid tự giãn theo mặc định), nhìn lệch
       * hàng rất xấu. Tách nhóm nội dung riêng + `mt-auto` ở nút đẩy nó xuống
       * SÁT ĐÁY mọi thẻ, để hàng nút luôn thẳng hàng bất kể bàn nào có nhiều
       * nội dung hơn.
       */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-2xl font-bold">
          <ShapeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Bàn {table.table_number}
        </span>
        <Badge variant={STATUS_BADGE_VARIANT[table.status]}>{TABLE_STATUS_LABEL[table.status]}</Badge>
        {table.activeOrders.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {itemCount} món · <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </div>
        )}
        {hasPendingCall && (
          <p className="text-xs font-medium text-destructive">
            {table.pendingStaffCalls.length} yêu cầu đang chờ
          </p>
        )}
        {/*
         * Module 18: badge THAM KHẢO cho biết bàn này đã có khách đặt trước —
         * KHÔNG ảnh hưởng màu/trạng thái bàn (xem upcomingReservation ở
         * types/index.ts). Quản lý đầy đủ (xác nhận/gán bàn/huỷ...) làm ở
         * `/staff/reservations`, ở đây chỉ hiển thị để nhân viên không xếp
         * nhầm khách vãng lai vào bàn đã có người đặt.
         */}
        {table.upcomingReservation && (
          <p className="flex items-center gap-1 text-xs font-medium text-primary">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            {new Date(table.upcomingReservation.reservation_time).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {table.upcomingReservation.customer_name}
          </p>
        )}
      </div>

      {/*
       * Module 13: bàn "Bàn dọn dẹp" ưu tiên hiện nút xác nhận dọn xong thay
       * vì "Gọi món hộ" — bàn đang chờ dọn thì chưa có khách để gọi món hộ.
       */}
      {table.status === "needs_cleaning" && onMarkCleaned ? (
        <button
          type="button"
          onClick={handleMarkCleanedClick}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-100 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Đã dọn xong
        </button>
      ) : (
        onOrderForCustomer && (
          <button
            type="button"
            onClick={handleOrderForCustomerClick}
            className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Gọi món hộ
          </button>
        )
      )}
    </div>
  );
}
