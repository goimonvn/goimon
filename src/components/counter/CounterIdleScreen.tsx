"use client";

import { useMenu } from "@/hooks/useMenu";
import { formatCurrency } from "@/lib/utils";
import { Coffee } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const SLIDE_INTERVAL_MS = 5000;

/**
 * Màn chờ mặc định của Màn hình phụ (Module 16) khi chưa có bàn nào được thu
 * ngân "hiện lên" — chạy slideshow tự động qua các món CÒN HÀNG có ảnh, lấy
 * từ ĐÚNG `useMenu()` đã dùng cho khách gọi món (Module 1) nên luôn khớp với
 * thực đơn/giá hiện tại, không cần tự lưu thêm danh sách "món nổi bật" nào
 * khác. Nếu quán chưa có món nào gắn ảnh, chỉ hiện logo + tên quán.
 */
export function CounterIdleScreen() {
  const { categories } = useMenu();
  const [index, setIndex] = useState(0);

  const items = useMemo(
    () => categories.flatMap((category) => category.items).filter((item) => item.is_available && item.image_url),
    [categories]
  );

  useEffect(() => {
    if (items.length === 0) return;
    setIndex(0);
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [items.length]);

  const current = items[index] ?? null;

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
      {current?.image_url && (
        <div className="absolute inset-0">
          {/* key={current.id} — buộc Next.js dựng lại <Image> mỗi lần đổi món, tránh giữ ảnh cũ trong lúc ảnh mới đang tải. */}
          <Image
            key={current.id}
            src={current.image_url}
            alt={current.name}
            fill
            sizes="100vw"
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/60 to-primary/40" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
        <Coffee className="h-16 w-16" />
        <h1 className="text-5xl font-bold">Gọi Món</h1>
        <p className="text-lg text-primary-foreground/80">Chào mừng quý khách!</p>

        {current && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl bg-black/20 px-10 py-6 backdrop-blur-sm">
            <p className="text-3xl font-semibold">{current.name}</p>
            <p className="text-2xl font-bold text-amber-200">{formatCurrency(current.price)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
