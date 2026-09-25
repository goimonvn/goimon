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
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { broadcastCounterDisplayEvent } from "@/services/counterDisplay.service";
import { createPayosPaymentLink } from "@/services/order.service";
import { buildReceiptData, printReceiptDirect } from "@/services/print.service";
import { resolveStaffCall } from "@/services/staffCall.service";
import { getVatInvoiceForOrder } from "@/services/vatInvoice.service";
import {
  ORDER_ITEM_STATUS_LABEL,
  STAFF_CALL_LABEL,
  TABLE_STATUS_LABEL,
  type TableWithOrders,
} from "@/types";
import { FileText, MonitorOff, Printer, Settings2, Tv, Wallet, Zap } from "lucide-react";
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
  // Module 16: gửi tín hiệu qua Broadcast tới Màn hình phụ tại quầy.
  const [sendingToDisplay, setSendingToDisplay] = useState(false);
  const [startingCounterPayment, setStartingCounterPayment] = useState(false);
  // Module 17: nút "Thanh toán màn hình phụ" cũng tạo link PayOS giống
  // CheckoutSheet — ẩn luôn nếu quán đã tắt "Thanh toán Tự động PayOS" ở
  // /admin/settings, tránh để lại 1 đường tạo link PayOS khác không bị tắt
  // theo cùng cấu hình (fail-open `?? true` khi đang tải/lỗi).
  const { settings: paymentSettings } = usePaymentSettings();
  const payosEnabled = paymentSettings?.enable_payos ?? true;

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

  /**
   * "Hiện lên màn hình phụ" (Module 16) — chỉ gửi tín hiệu "hiện bàn này lên"
   * (broadcast ORDER_UPDATED), KHÔNG gửi kèm danh sách món: Màn hình phụ tự
   * tải/lắng nghe lại đúng đơn của bàn bằng `useActiveOrders` (giống khách,
   * Module 1) nên nội dung món luôn khớp dữ liệu thật, kể cả khi khách gọi
   * thêm món ngay sau khi thu ngân vừa bấm nút này.
   */
  async function handleShowOnCounterDisplay() {
    if (!table) return;
    setSendingToDisplay(true);
    try {
      await broadcastCounterDisplayEvent({
        type: "ORDER_UPDATED",
        tableId: table.id,
        tableNumber: table.table_number,
      });
      toast.success(`Đã hiện Bàn ${table.table_number} lên màn hình phụ.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể kết nối tới màn hình phụ tại quầy."
      );
    } finally {
      setSendingToDisplay(false);
    }
  }

  /**
   * "Thanh toán qua màn hình phụ" (Module 16) — tạo link/mã VietQR động PayOS
   * cho ĐÚNG đơn "neo" của bàn (đơn gần nhất, giống quy ước ở
   * `/order/status/page.tsx`), dùng LẠI đúng route `/api/payments/payos/create-link`
   * của Module 15 (server tự tính lại số tiền = tổng cả bàn), rồi phát
   * PAYMENT_STARTED để Màn hình phụ hiện mã QR lớn cho khách quét ngay tại
   * quầy — khác với `CheckoutSheet` (khách tự bấm trên điện thoại), ở đây
   * CHÍNH THU NGÂN bấm hộ khi khách đã đứng tại quầy.
   */
  async function handleStartCounterPayment() {
    if (!table) return;
    const anchorOrderId = table.activeOrders.at(-1)?.id;
    if (!anchorOrderId) {
      toast.error("Bàn không có đơn nào cần thanh toán.");
      return;
    }

    setStartingCounterPayment(true);
    try {
      const link = await createPayosPaymentLink(anchorOrderId);
      await broadcastCounterDisplayEvent({
        type: "PAYMENT_STARTED",
        tableId: table.id,
        tableNumber: table.table_number,
        orderId: anchorOrderId,
        orderCode: link.orderCode,
        amount: link.amount,
        qrImageUrl: link.qrImageUrl,
      });
      toast.success(`Đã gửi mã QR thanh toán ra màn hình phụ cho Bàn ${table.table_number}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể bắt đầu thanh toán trên màn hình phụ."
      );
    } finally {
      setStartingCounterPayment(false);
    }
  }

  /** "Tắt màn hình phụ" (Module 16) — đưa Màn hình phụ về lại màn chờ, dùng khi thu ngân chọn nhầm bàn hoặc muốn dọn màn hình giữa chừng. */
  async function handleClearCounterDisplay() {
    try {
      await broadcastCounterDisplayEvent({ type: "ORDER_CLEARED" });
    } catch {
      // Bỏ qua — đây chỉ là thao tác dọn màn hình phụ về màn chờ, không quan
      // trọng bằng các luồng thanh toán nên không cần báo lỗi làm phiền thu ngân.
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
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Đơn #{order.id.slice(0, 8).toUpperCase()}
                    {/* Module 15: đơn đang chờ khách quét mã VietQR tự động (PayOS), hoặc lần quét gần nhất thất bại. */}
                    {order.payment_order_code !== null && order.payment_status === "unpaid" && (
                      <Badge variant="warning" className="shrink-0">
                        ⏳ Chờ VietQR tự động
                      </Badge>
                    )}
                    {order.payment_status === "failed" && (
                      <Badge variant="destructive" className="shrink-0">
                        ⚠️ VietQR thất bại
                      </Badge>
                    )}
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

            {/*
              Module 16: Màn hình phụ tại quầy — 2 nút riêng, độc lập với luồng
              thanh toán thủ công (PaymentConfirmSheet) bên dưới. Layout dọc
              (icon trên, chữ dưới, tự xuống dòng) thay vì hàng ngang mặc định
              của Button — nhãn "Thanh toán màn hình phụ" quá dài để nằm vừa 1
              hàng ở khung 2 cột trên điện thoại nhỏ (từng bị tràn khỏi khối
              nút, xem ảnh chụp lỗi lúc test thật) nếu giữ nguyên
              `whitespace-nowrap`/chiều cao cố định mặc định của Button.
            */}
            <div className={`mb-2 grid gap-2 ${payosEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
              <Button
                variant="outline"
                disabled={sendingToDisplay}
                onClick={() => void handleShowOnCounterDisplay()}
                className="h-auto min-h-11 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight"
              >
                <Tv className="h-4 w-4 shrink-0" />
                <span>{sendingToDisplay ? "Đang gửi..." : "Hiện màn hình phụ"}</span>
              </Button>
              {/* Module 17: chỉ hiện khi quán còn bật "Thanh toán Tự động PayOS" ở /admin/settings — xem ghi chú payosEnabled bên trên. */}
              {payosEnabled && (
                <Button
                  variant="outline"
                  disabled={startingCounterPayment}
                  onClick={() => void handleStartCounterPayment()}
                  className="h-auto min-h-11 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight"
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>{startingCounterPayment ? "Đang tạo mã..." : "Thanh toán màn hình phụ"}</span>
                </Button>
              )}
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
            <button
              type="button"
              onClick={() => void handleClearCounterDisplay()}
              className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground underline underline-offset-2"
            >
              <MonitorOff className="h-3 w-3" />
              Tắt màn hình phụ (quay về màn chờ)
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
