"use client";

import { useMenu } from "@/hooks/useMenu";
import { formatCurrency } from "@/lib/utils";
import type { MenuItemWithOptions } from "@/types";
import { Coffee, Utensils } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const SLIDE_INTERVAL_MS = 8000;
/** Số món tối đa hiển thị trên 1 trang — lưới 3 cột x 3 hàng vừa khít màn hình ngang tablet/iPad mà không cần cuộn. */
const ITEMS_PER_SLIDE = 9;

interface MenuSlide {
  key: string;
  categoryName: string;
  items: MenuItemWithOptions[];
}

/**
 * Màn chờ mặc định của Màn hình phụ (Module 16) khi chưa có bàn nào được thu
 * ngân "hiện lên" — hiển thị NHƯ 1 MENU TỔNG (bảng thực đơn điện tử) thay vì
 * slideshow từng món đơn lẻ như bản đầu: mỗi lượt hiện TRỌN 1 trang của 1
 * danh mục (tên danh mục + lưới món còn hàng kèm ảnh/tên/giá), tự động
 * chuyển trang sau vài giây, lặp vòng quanh trang đầu. Danh mục nhiều hơn
 * `ITEMS_PER_SLIDE` món tự tách thành nhiều trang liên tiếp (vẫn giữ tên
 * danh mục) thay vì cắt bớt món.
 *
 * Dữ liệu lấy từ ĐÚNG `useMenu()` đã dùng cho khách gọi món (Module 1) nên
 * luôn khớp với thực đơn/giá hiện tại, không cần tự lưu thêm danh sách "món
 * nổi bật" nào khác. Món KHÔNG có ảnh vẫn hiển thị (chỉ đổi ảnh minh hoạ
 * thành icon) — khác bản đầu (chỉ lọc theo có ảnh) vì mục tiêu ở đây là "xem
 * được cả menu", không phải quảng cáo hình ảnh.
 */
export function CounterIdleScreen() {
  const { categories } = useMenu();
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo<MenuSlide[]>(() => {
    const result: MenuSlide[] = [];
    for (const category of categories) {
      const available = category.items.filter((item) => item.is_available);
      if (available.length === 0) continue;
      for (let start = 0; start < available.length; start += ITEMS_PER_SLIDE) {
        result.push({
          key: `${category.id}-${start}`,
          categoryName: category.name,
          items: available.slice(start, start + ITEMS_PER_SLIDE),
        });
      }
    }
    return result;
  }, [categories]);

  useEffect(() => {
    if (slides.length <= 1) return;
    setSlideIndex(0);
    const interval = setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [slides.length]);

  const currentSlide = slides[slideIndex] ?? null;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <div className="flex items-center justify-center gap-3 px-8 py-6">
        <Coffee className="h-9 w-9 shrink-0" />
        <h1 className="text-4xl font-bold">Gọi Món</h1>
      </div>

      {!currentSlide ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-2xl text-primary-foreground/80">Chào mừng quý khách!</p>
        </div>
      ) : (
        <div
          key={currentSlide.key}
          className="flex flex-1 flex-col overflow-hidden px-10 pb-6 duration-500 animate-in fade-in"
        >
          <h2 className="mb-4 shrink-0 text-center text-3xl font-semibold text-amber-200">
            {currentSlide.categoryName}
          </h2>
          <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-4">
            {currentSlide.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 overflow-hidden rounded-2xl bg-black/20 p-3 backdrop-blur-sm"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/20">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Utensils className="h-7 w-7 text-primary-foreground/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{item.name}</p>
                  <p className="text-base font-bold text-amber-200">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {slides.length > 1 && (
        <p className="pb-6 text-center text-sm text-primary-foreground/70">
          Trang {slideIndex + 1}/{slides.length}
        </p>
      )}
    </div>
  );
}
