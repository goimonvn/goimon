"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getPrinterSettings } from "@/lib/printerSettings";
import { formatCurrency } from "@/lib/utils";
import { buildReceiptData, printReceiptDirect } from "@/services/print.service";
import { resolveStaffCall } from "@/services/staffCall.service";
import { getVatInvoiceForOrder } from "@/services/vatInvoice.service";
import {
  ORDER_ITEM_STATUS_LABEL,
  STAFF_CALL_LABEL,
  TABLE_STATUS_LABEL,
  type TableWithOrders,
} from "@/types";
import { FileText, Printer, Settings2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PrinterSettingsDialog } from "./PrinterSettingsDialog";

interface TableDetailSheetProps {
  table: TableWithOrders | null;
  onOpenChange: (open: boolean) => void;
  onPrintReceipt: (table: TableWithOrders) => void;
  onOpenPayment: (table: TableWithOrders) => void;
}

export function TableDetailSheet({
  table,
  onOpenChange,
  onPrintReceipt,
  onOpenPayment,
}: TableDetailSheetProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);

  const total = table?.activeOrders.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;

  async function handleResolveCall(callId: string) {
    setResolvingId(callId);
    try {
      await resolveStaffCall(callId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật yêu cầu.");
    } finally {
      setResolvingId(null);
    }
  }

  /**
   * In trực tiếp (LAN/Bluetooth theo cấu hình thiết bị) — KHÔNG qua hộp thoại
   * in của trình duyệt. Nếu thất bại (chưa cấu hình máy in, mất kết nối...),
   * báo lỗi rõ ràng và gợi ý dùng nút "In qua trình duyệt" dự phòng bên dưới
   * thay vì tự động chuyển — nhân viên chủ động chọn cách khác.
   */
  async function handleDirectPrint() {
    if (!table) return;
    setPrinting(true);
    try {
      const settings = getPrinterSettings();
      const latestOrder = table.activeOrders[table.activeOrders.length - 1] ?? null;
      const vat = latestOrder ? await getVatInvoiceForOrder(latestOrder.id).catch(() => null) : null;
      const receipt = buildReceiptData(table, table.activeOrders, null, vat);
      await printReceiptDirect(receipt, settings);
      toast.success("Đã gửi lệnh in tới máy in.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể in trực tiếp. Vui lòng dùng 'In qua trình duyệt' bên dưới."
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Sheet open={table !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col p-0">
        {table && (
        <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Bàn {table.table_number}
            <Badge variant="outline">{TABLE_STATUS_LABEL[table.status]}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {table.pendingStaffCalls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Yêu cầu đang chờ</p>
              {table.pendingStaffCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 p-3"
                >
                  <span className="text-sm font-medium">{STAFF_CALL_LABEL[call.request_type]}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolvingId === call.id}
                    onClick={() => void handleResolveCall(call.id)}
                  >
                    Đã xử lý
                  </Button>
                </div>
              ))}
            </div>
          )}

          {table.activeOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Bàn chưa có đơn hàng nào đang hoạt động.
            </p>
          ) : (
            <div className="space-y-3">
              {table.activeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Đơn #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <ul className="space-y-1.5">
                    {order.order_items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {item.quantity}x {item.menu_item?.name ?? "Món"}
                          {item.notes && (
                            <span className="block text-xs italic text-muted-foreground">
                              {item.notes}
                            </span>
                          )}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {ORDER_ITEM_STATUS_LABEL[item.item_status]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {table.activeOrders.length > 0 && (
          <SheetFooter className="border-t bg-background">
            <div className="mb-2 flex items-center justify-between text-base">
              <span className="font-medium">Tổng cộng</span>
              <span className="font-bold text-primary">{formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Cài đặt máy in"
                onClick={() => setPrinterSettingsOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" disabled={printing} onClick={() => void handleDirectPrint()}>
                <Printer className="h-4 w-4" />
                {printing ? "Đang in..." : "In hoá đơn"}
              </Button>
              <Button onClick={() => onOpenPayment(table)}>
                <Wallet className="h-4 w-4" />
                Thanh toán
              </Button>
            </div>
            <button
              type="button"
              onClick={() => onPrintReceipt(table)}
              className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground underline underline-offset-2"
            >
              <FileText className="h-3 w-3" />
              In qua hộp thoại trình duyệt (dự phòng)
            </button>
          </SheetFooter>
        )}
        </>
        )}
      </SheetContent>

      <PrinterSettingsDialog open={printerSettingsOpen} onOpenChange={setPrinterSettingsOpen} />
    </Sheet>
  );
}
