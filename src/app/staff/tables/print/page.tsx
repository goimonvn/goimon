"use client";

import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCurrency } from "@/lib/utils";
import { getActiveOrdersByTable } from "@/services/order.service";
import { getTableById } from "@/services/table.service";
import type { OrderWithItems } from "@/types";
import type { TablesRow } from "@/types/database.types";
import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { toast } from "sonner";

const SHOP_NAME = "GỌI MÓN — QUÁN CÀ PHÊ";

function PrintReceiptContent() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  const [table, setTable] = useState<TablesRow | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const [tableData, orderData] = await Promise.all([
          getTableById(tableId as string),
          getActiveOrdersByTable(tableId as string),
        ]);
        if (cancelled) return;
        setTable(tableData);
        setOrders(orderData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải hoá đơn.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  useEffect(() => {
    if (!loading && table) {
      // Tự động mở hộp thoại in ngay khi dữ liệu đã sẵn sàng; nhân viên vẫn có
      // thể bấm "In lại" thủ công nếu lỡ đóng hộp thoại hoặc muốn in lại.
      const id = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(id);
    }
  }, [loading, table]);

  if (!tableId) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Thiếu thông tin bàn.</p>;
  }

  if (loading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Đang tải hoá đơn...</p>;
  }

  if (!table) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Không tìm thấy bàn.</p>;
  }

  const grandTotal = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const now = new Date();

  return (
    <div className="mx-auto max-w-sm p-6 font-mono text-sm print:max-w-full print:p-0 print:text-black">
      <div className="mb-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          In lại
        </Button>
      </div>

      <div className="text-center">
        <p className="text-base font-bold">{SHOP_NAME}</p>
        <p className="text-xs text-muted-foreground print:text-black">HOÁ ĐƠN TẠM TÍNH</p>
      </div>

      <div className="my-3 border-t border-dashed" />

      <div className="flex justify-between">
        <span>Bàn số</span>
        <span className="font-bold">{table.table_number}</span>
      </div>
      <div className="flex justify-between">
        <span>Thời gian in</span>
        <span>{now.toLocaleString("vi-VN")}</span>
      </div>

      <div className="my-3 border-t border-dashed" />

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground print:text-black">Chưa có đơn hàng nào.</p>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="mb-3">
            <p className="mb-1 text-xs text-muted-foreground print:text-black">
              Đơn #{order.id.slice(0, 8).toUpperCase()}
            </p>
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.quantity}x {item.menu_item?.name ?? "Món"}
                </span>
                {item.menu_item?.price != null && (
                  <span>{formatCurrency(item.menu_item.price * item.quantity)}</span>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      <div className="my-3 border-t border-dashed" />

      <div className="flex justify-between text-base font-bold">
        <span>TỔNG CỘNG</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground print:text-black">
        * Đơn giá từng món chỉ mang tính tham khảo theo giá hiện tại của menu. Số tiền chính thức
        khách cần thanh toán là TỔNG CỘNG phía trên.
      </p>

      <div className="my-3 border-t border-dashed" />
      <p className="text-center">Cảm ơn quý khách!</p>
    </div>
  );
}

export default function PrintReceiptPage() {
  usePageTitle("In hoá đơn");
  return (
    <Suspense fallback={null}>
      <PrintReceiptContent />
    </Suspense>
  );
}
