"use client";

import { playTingSound } from "@/lib/sound";
import { formatCurrency } from "@/lib/utils";
import { PartyPopper } from "lucide-react";
import { useEffect, useRef } from "react";

interface CounterSuccessScreenProps {
  orderCode: number;
  amount: number;
}

/**
 * Trạng thái "success" của Màn hình phụ (Module 16) — vào đúng 1 lần mỗi khi
 * `useCounterDisplay` polling phát hiện thanh toán xong (xem hook đó), tự
 * quay về "idle" sau vài giây. `playedRef` chặn phát tiếng "ting" 2 lần nếu
 * effect bị gọi lại (vd React StrictMode ở môi trường dev) — component này
 * chỉ được mount đúng lúc chuyển vào "success" nên ref luôn bắt đầu lại đúng
 * mỗi lần vào màn này.
 */
export function CounterSuccessScreen({ orderCode, amount }: CounterSuccessScreenProps) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    playTingSound();
  }, []);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-center text-white">
      <PartyPopper className="h-20 w-20" />
      <p className="text-4xl font-bold">Thanh toán thành công!</p>
      <p className="text-xl">Mã đơn của quý khách là #{orderCode}</p>
      <p className="text-2xl font-semibold">{formatCurrency(amount)}</p>
      <p className="mt-4 text-white/80">Cảm ơn quý khách. Hẹn gặp lại quý khách lần sau!</p>
    </div>
  );
}
