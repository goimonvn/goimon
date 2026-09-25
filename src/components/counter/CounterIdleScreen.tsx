"use client";

import { useCombos } from "@/hooks/useCombos";
import { useMenu } from "@/hooks/useMenu";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Coffee, Gift, Utensils } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Số món/combo tối đa hiển thị trên 1 trang — lưới 3 cột x 3 hàng vừa khít màn hình ngang tablet/iPad mà không cần cuộn. */
const ITEMS_PER_SLIDE = 9;
/** Vuốt tối thiểu bao nhiêu px mới tính là 1 lần chuyển trang — tránh chuyển nhầm khi khách chỉ chạm nhẹ/rung tay. */
const SWIPE_THRESHOLD_PX = 60;

interface MenuSlideItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

interface MenuSlide {
  key: string;
  title: string;
  isCombo: boolean;
  items: MenuSlideItem[];
}

/**
 * Màn chờ mặc định của Màn hình phụ (Module 16) khi chưa có bàn nào được thu
 * ngân "hiện lên" — hiển thị NHƯ 1 CUỐN MENU thật: khách tự VUỐT (kéo ngang
 * bằng ngón tay trên tablet, hoặc kéo chuột khi xem thử trên máy tính) để lật
 * qua từng trang, KHÔNG tự động chuyển trang nữa (khác 2 bản trước — theo
 * đúng yêu cầu người dùng). Đây là màn DUY NHẤT trong Module 16 cho phép
 * khách chạm vào — 3 trạng thái còn lại (review/payment/success) vẫn thuần
 * hiển thị, không tương tác, vì đó là lúc thu ngân đang chủ động điều khiển
 * qua Broadcast.
 *
 * Thứ tự trang: **Combo Tiết Kiệm luôn đứng TRƯỚC** (nếu quán có combo đang
 * bật) — đúng vị trí "phía trên danh mục" như trang gọi món của khách vẫn
 * làm (`ComboSection` hiện trên `CategoryTabs`, Module 11) — rồi lần lượt
 * từng danh mục món. Dữ liệu lấy từ ĐÚNG `useMenu()`/`useCombos()` đã dùng
 * cho khách gọi món (Module 1/11) nên luôn khớp thực đơn/giá/combo hiện tại,
 * không cần tự lưu thêm danh sách riêng nào khác.
 */
export function CounterIdleScreen() {
  const { categories } = useMenu();
  const { combos } = useCombos();
  const [slideIndex, setSlideIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number | null>(null);

  const slides = useMemo<MenuSlide[]>(() => {
    const result: MenuSlide[] = [];

    for (let start = 0; start < combos.length; start += ITEMS_PER_SLIDE) {
      result.push({
        key: `combo-${start}`,
        title: "🎁 Combo Tiết Kiệm",
        isCombo: true,
        items: combos.slice(start, start + ITEMS_PER_SLIDE).map((combo) => ({
          id: combo.id,
          name: combo.name,
          price: combo.price,
          imageUrl: combo.image_url,
        })),
      });
    }

    for (const category of categories) {
      const available = category.items.filter((item) => item.is_available);
      if (available.length === 0) continue;
      for (let start = 0; start < available.length; start += ITEMS_PER_SLIDE) {
        result.push({
          key: `${category.id}-${start}`,
          title: category.name,
          isCombo: false,
          items: available.slice(start, start + ITEMS_PER_SLIDE).map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            imageUrl: item.image_url,
          })),
        });
      }
    }

    return result;
  }, [combos, categories]);

  // Nếu số trang giảm (vd chủ quán vừa tắt bớt combo/món) mà slideIndex đang
  // trỏ ra ngoài phạm vi mới, tự kéo về trang cuối cùng còn lại thay vì lỗi.
  const clampedIndex = slides.length === 0 ? 0 : Math.min(slideIndex, slides.length - 1);
  const isDragging = dragStartX.current !== null;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartX.current = event.clientX;
    setDragOffset(0);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return;
    setDragOffset(event.clientX - dragStartX.current);
  }

  function endDrag() {
    if (dragStartX.current === null) return;
    if (dragOffset <= -SWIPE_THRESHOLD_PX) {
      setSlideIndex((current) => Math.min(current + 1, slides.length - 1));
    } else if (dragOffset >= SWIPE_THRESHOLD_PX) {
      setSlideIndex((current) => Math.max(current - 1, 0));
    }
    dragStartX.current = null;
    setDragOffset(0);
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <div className="flex items-center justify-center gap-3 px-8 py-6">
        <Coffee className="h-9 w-9 shrink-0" />
        <h1 className="text-4xl font-bold">Gọi Món</h1>
      </div>

      {slides.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-2xl text-primary-foreground/80">Chào mừng quý khách!</p>
        </div>
      ) : (
        <div
          className="flex-1 select-none overflow-hidden"
          style={{ touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(${-clampedIndex * 100}% + ${dragOffset}px))`,
              transition: isDragging ? "none" : "transform 300ms ease",
            }}
          >
            {slides.map((slide) => (
              <div
                key={slide.key}
                className="flex h-full w-full shrink-0 flex-col overflow-hidden px-10 pb-4"
              >
                <h2 className="mb-4 shrink-0 text-center text-3xl font-semibold text-amber-200">
                  {slide.title}
                </h2>
                <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-4">
                  {slide.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 overflow-hidden rounded-2xl bg-black/20 p-3 backdrop-blur-sm"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/20">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="pointer-events-none object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            {slide.isCombo ? (
                              <Gift className="h-7 w-7 text-primary-foreground/60" />
                            ) : (
                              <Utensils className="h-7 w-7 text-primary-foreground/60" />
                            )}
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
            ))}
          </div>
        </div>
      )}

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-6 pt-2 text-primary-foreground/70">
          <ChevronLeft className="h-4 w-4" />
          <p className="text-sm">Vuốt để xem trang khác — {clampedIndex + 1}/{slides.length}</p>
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
