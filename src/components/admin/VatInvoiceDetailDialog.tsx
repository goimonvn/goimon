"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { estimateVatAmount, formatCurrency } from "@/lib/utils";
import type { VatInvoiceWithOrder } from "@/types";

interface VatInvoiceDetailDialogProps {
  invoice: VatInvoiceWithOrder | null;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/** Chi tiết một hoá đơn VAT — thông tin công ty đầy đủ để chủ quán đối chiếu khi xuất hoá đơn điện tử ngoài hệ thống kế toán. */
export function VatInvoiceDetailDialog({ invoice, onOpenChange }: VatInvoiceDetailDialogProps) {
  const vatAmount = invoice?.order ? estimateVatAmount(invoice.order.total_amount) : 0;

  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {invoice.company_name}
                {invoice.order?.table_number != null && (
                  <Badge variant="outline">Bàn {invoice.order.table_number}</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Mã số thuế</dt>
                <dd className="font-medium">{invoice.tax_code}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Địa chỉ</dt>
                <dd className="text-right font-medium">{invoice.address}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{invoice.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Thời gian</dt>
                <dd className="font-medium">{formatDateTime(invoice.created_at)}</dd>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Tổng tiền đơn hàng</dt>
                  <dd className="font-medium">{formatCurrency(invoice.order?.total_amount ?? 0)}</dd>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Trong đó tiền VAT (tạm tính)</dt>
                  <dd className="font-bold text-primary">{formatCurrency(vatAmount)}</dd>
                </div>
              </div>
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
