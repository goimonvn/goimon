"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDiscountLabel, previewPromotionDiscount } from "@/lib/promotions";
import { cn } from "@/lib/utils";
import { findPromotionByCode, getAutoApplicablePromotions } from "@/services/promotion.service";
import type { PromotionsRow } from "@/types/database.types";
import { Sparkles, Ticket, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface AppliedPromotion {
  promotionId: string;
  discountAmount: number;
}

interface CouponSectionProps {
  subtotal: number;
  onAppliedChange: (applied: AppliedPromotion | null) => void;
}

/**
 * Khu vực áp dụng khuyến mãi ở giỏ hàng (Module 9) — khách tự nhập mã HOẶC hệ
 * thống TỰ ÁP DỤNG khuyến mãi Happy Hour đang trong khung giờ vàng (không cần
 * mã, `requires_code = false`) nếu khách chưa nhập mã thủ công nào. Mã thủ
 * công LUÔN ưu tiên hơn khuyến mãi tự động một khi khách chủ động áp dụng.
 *
 * CHỈ xem trước (`previewPromotionDiscount`) để hiển thị ngay, không cần
 * round-trip server cho mỗi lần cart đổi — RPC `redeem_promotion` ở server
 * luôn là nguồn xác thực CUỐI CÙNG lúc gửi đơn (xem order.service.createOrder),
 * nên xem trước sai lệch nhẹ (vd mã vừa hết lượt) không gây hậu quả nghiêm
 * trọng, chỉ khiến đơn được gửi theo giá gốc kèm thông báo.
 */
export function CouponSection({ subtotal, onAppliedChange }: CouponSectionProps) {
  const [codeInput, setCodeInput] = useState("");
  const [manualPromotion, setManualPromotion] = useState<PromotionsRow | null>(null);
  const [autoPromotions, setAutoPromotions] = useState<PromotionsRow[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    getAutoApplicablePromotions()
      .then(setAutoPromotions)
      .catch(() => setAutoPromotions([])); // Không chặn giỏ hàng nếu tải khuyến mãi tự động lỗi.
  }, []);

  const manualPreview = useMemo(
    () => (manualPromotion ? previewPromotionDiscount(manualPromotion, subtotal) : null),
    [manualPromotion, subtotal]
  );

  const bestAutoPromotion = useMemo(() => {
    if (manualPromotion) return null; // Mã thủ công luôn ưu tiên hơn tự động.
    let best: { promotion: PromotionsRow; discountAmount: number } | null = null;
    for (const promotion of autoPromotions) {
      const preview = previewPromotionDiscount(promotion, subtotal);
      if (preview.eligible && (!best || preview.discountAmount > best.discountAmount)) {
        best = { promotion, discountAmount: preview.discountAmount };
      }
    }
    return best;
  }, [autoPromotions, manualPromotion, subtotal]);

  const effective = useMemo<AppliedPromotion | null>(() => {
    if (manualPromotion && manualPreview?.eligible) {
      return { promotionId: manualPromotion.id, discountAmount: manualPreview.discountAmount };
    }
    if (bestAutoPromotion) {
      return { promotionId: bestAutoPromotion.promotion.id, discountAmount: bestAutoPromotion.discountAmount };
    }
    return null;
  }, [manualPromotion, manualPreview, bestAutoPromotion]);

  useEffect(() => {
    onAppliedChange(effective);
  }, [effective, onAppliedChange]);

  async function handleApply() {
    const trimmed = codeInput.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập mã giảm giá.");
      return;
    }
    setApplying(true);
    try {
      const promotion = await findPromotionByCode(trimmed);
      if (!promotion) {
        toast.error("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
        return;
      }
      const preview = previewPromotionDiscount(promotion, subtotal);
      setManualPromotion(promotion);
      if (preview.eligible) {
        toast.success(`Đã áp dụng mã — giảm ${formatDiscountLabel(promotion)}.`);
      } else {
        toast.warning(preview.reason ?? "Mã giảm giá chưa thể áp dụng cho đơn hiện tại.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể áp dụng mã giảm giá.");
    } finally {
      setApplying(false);
    }
  }

  function handleRemove() {
    setManualPromotion(null);
    setCodeInput("");
  }

  if (manualPromotion) {
    return (
      <div
        className={cn(
          "space-y-1 rounded-xl border p-3",
          manualPreview?.eligible ? "border-primary/30 bg-primary/5" : "border-dashed"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Ticket className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">
              Mã <span className="font-medium">{manualPromotion.code}</span> — giảm{" "}
              {formatDiscountLabel(manualPromotion)}
            </span>
          </div>
          <button
            type="button"
            aria-label="Bỏ mã giảm giá"
            onClick={handleRemove}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!manualPreview?.eligible && <p className="text-xs text-destructive">{manualPreview?.reason}</p>}
      </div>
    );
  }

  if (bestAutoPromotion) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Đang trong <span className="font-medium">Giờ Vàng</span> — tự động giảm{" "}
          {formatDiscountLabel(bestAutoPromotion.promotion)} cho đơn này.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Ticket className="h-4 w-4 text-primary" />
        Mã giảm giá (không bắt buộc)
      </p>
      <div className="flex gap-2">
        <Input placeholder="Nhập mã giảm giá" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
        <Button variant="outline" disabled={applying} onClick={() => void handleApply()}>
          {applying ? "..." : "Áp dụng"}
        </Button>
      </div>
    </div>
  );
}
