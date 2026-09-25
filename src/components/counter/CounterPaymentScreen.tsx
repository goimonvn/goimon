"use client";

import { formatCurrency } from "@/lib/utils";
import { Loader2, QrCode } from "lucide-react";
import Image from "next/image";

interface CounterPaymentScreenProps {
  tableNumber: number;
  amount: number;
  qrImageUrl: string;
}

/**
 * Trạng thái "payment" của Màn hình phụ (Module 16) — hiện mã VietQR ĐỘNG do
 * PayOS cấp (thu ngân bấm "Thanh toán qua màn hình phụ" ở `/staff/tables`,
 * dùng chung route `/api/payments/payos/create-link` với Module 15). Trang
 * cha (`useCounterDisplay`) tự polling xác nhận thanh toán, không cần trang
 * này biết gì thêm ngoài việc hiển thị — xem hooks/useCounterDisplay.ts.
 */
export function CounterPaymentScreen({ tableNumber, amount, qrImageUrl }: CounterPaymentScreenProps) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <p className="text-2xl font-medium text-muted-foreground">Bàn {tableNumber}</p>
      <p className="flex items-center gap-2 text-xl font-semibold text-primary">
        <QrCode className="h-6 w-6" />
        Quét mã để thanh toán
      </p>

      <div className="rounded-3xl border-4 border-primary/20 bg-white p-6 shadow-lg">
        <Image src={qrImageUrl} alt="Mã VietQR thanh toán" width={360} height={360} unoptimized />
      </div>

      <p className="text-4xl font-bold text-primary">{formatCurrency(amount)}</p>

      <p className="flex items-center gap-2 text-lg text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Đang chờ xác nhận thanh toán tự động...
      </p>
    </div>
  );
}
