"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPromotion, updatePromotionDetails } from "@/services/promotion.service";
import { PROMOTION_DISCOUNT_TYPE_LABEL, type PromotionFormInput } from "@/types";
import type { PromotionDiscountType, PromotionsRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface PromotionFormDialogProps {
  open: boolean;
  /** null = đang tạo khuyến mãi mới. */
  promotion: PromotionsRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** ISO string (từ DB) -> giá trị cho input[type=datetime-local] (giờ theo trình duyệt, không có timezone). */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:MM:SS" (từ DB) -> "HH:MM" cho input[type=time]. */
function toTimeInputValue(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

const DEFAULT_START = toDatetimeLocalValue(new Date().toISOString());
const DEFAULT_END = toDatetimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

/**
 * Form thêm/sửa khuyến mãi. `requiresCode` quyết định đây là mã khách tự nhập
 * hay khuyến mãi Happy Hour tự động áp dụng (ẩn ô nhập mã, `code` gửi lên là
 * `null`); bật thêm "Khung giờ vàng trong ngày" để giới hạn hiệu lực theo giờ
 * mỗi ngày trong khoảng start/end đã chọn — xem giải thích đầy đủ trong
 * schema.sql.
 */
export function PromotionFormDialog({ open, promotion, onOpenChange, onSaved }: PromotionFormDialogProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<PromotionDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrderValue, setMinOrderValue] = useState("0");
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [requiresCode, setRequiresCode] = useState(true);
  const [hasDailyWindow, setHasDailyWindow] = useState(false);
  const [dailyStartTime, setDailyStartTime] = useState("14:00");
  const [dailyEndTime, setDailyEndTime] = useState("16:00");
  const [usageLimit, setUsageLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(promotion?.code ?? "");
    setDescription(promotion?.description ?? "");
    setDiscountType(promotion?.discount_type ?? "percentage");
    setDiscountValue(promotion ? String(promotion.discount_value) : "10");
    setMinOrderValue(promotion ? String(promotion.min_order_value) : "0");
    setStartTime(promotion ? toDatetimeLocalValue(promotion.start_time) : DEFAULT_START);
    setEndTime(promotion ? toDatetimeLocalValue(promotion.end_time) : DEFAULT_END);
    setRequiresCode(promotion?.requires_code ?? true);
    setHasDailyWindow(Boolean(promotion?.daily_start_time));
    setDailyStartTime(toTimeInputValue(promotion?.daily_start_time ?? null) || "14:00");
    setDailyEndTime(toTimeInputValue(promotion?.daily_end_time ?? null) || "16:00");
    setUsageLimit(promotion?.usage_limit !== null && promotion?.usage_limit !== undefined ? String(promotion.usage_limit) : "");
  }, [open, promotion]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      toast.error("Vui lòng nhập mô tả khuyến mãi.");
      return;
    }
    const trimmedCode = code.trim();
    if (requiresCode && !trimmedCode) {
      toast.error("Vui lòng nhập mã giảm giá, hoặc tắt \"Yêu cầu nhập mã\" cho khuyến mãi tự động.");
      return;
    }
    const discountValueNumber = Number(discountValue);
    if (!Number.isFinite(discountValueNumber) || discountValueNumber <= 0) {
      toast.error("Mức giảm không hợp lệ.");
      return;
    }
    if (discountType === "percentage" && discountValueNumber > 100) {
      toast.error("Giảm theo phần trăm không được vượt quá 100%.");
      return;
    }
    const minOrderValueNumber = Number(minOrderValue);
    if (!Number.isFinite(minOrderValueNumber) || minOrderValueNumber < 0) {
      toast.error("Giá trị đơn tối thiểu không hợp lệ.");
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    const usageLimitNumber = usageLimit.trim() ? Number(usageLimit) : null;
    if (usageLimitNumber !== null && (!Number.isFinite(usageLimitNumber) || usageLimitNumber <= 0)) {
      toast.error("Giới hạn lượt dùng không hợp lệ (để trống nếu không giới hạn).");
      return;
    }

    const input: PromotionFormInput = {
      code: requiresCode ? trimmedCode : null,
      description: trimmedDescription,
      discountType,
      discountValue: discountValueNumber,
      minOrderValue: minOrderValueNumber,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      dailyStartTime: hasDailyWindow ? `${dailyStartTime}:00` : null,
      dailyEndTime: hasDailyWindow ? `${dailyEndTime}:00` : null,
      requiresCode,
      usageLimit: usageLimitNumber,
    };

    setSubmitting(true);
    try {
      if (promotion) {
        await updatePromotionDetails(promotion.id, input);
        toast.success("Đã cập nhật khuyến mãi.");
      } else {
        await createPromotion(input);
        toast.success("Đã tạo khuyến mãi mới.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu khuyến mãi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promotion ? "Sửa khuyến mãi" : "Thêm khuyến mãi mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="promo-requires-code"
              checked={requiresCode}
              onCheckedChange={(c) => setRequiresCode(c === true)}
            />
            <Label htmlFor="promo-requires-code" className="cursor-pointer font-normal">
              Yêu cầu khách nhập mã (tắt để tự động áp dụng — Happy Hour)
            </Label>
          </div>

          {requiresCode && (
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Mã giảm giá</Label>
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ví dụ: GIAM10K"
                className="uppercase"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="promo-description">Mô tả</Label>
            <Textarea
              id="promo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Giảm 10% cho đơn từ 100.000đ"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại giảm giá</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as PromotionDiscountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROMOTION_DISCOUNT_TYPE_LABEL) as PromotionDiscountType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PROMOTION_DISCOUNT_TYPE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-discount-value">
                Mức giảm ({discountType === "percentage" ? "%" : "đ"})
              </Label>
              <Input
                id="promo-discount-value"
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-min-order">Đơn tối thiểu (đ)</Label>
              <Input
                id="promo-min-order"
                type="number"
                min={0}
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-usage-limit">Giới hạn lượt dùng</Label>
              <Input
                id="promo-usage-limit"
                type="number"
                min={1}
                placeholder="Không giới hạn"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start-time">Bắt đầu hiệu lực</Label>
              <Input
                id="promo-start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end-time">Kết thúc hiệu lực</Label>
              <Input
                id="promo-end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-dashed p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="promo-daily-window"
                checked={hasDailyWindow}
                onCheckedChange={(c) => setHasDailyWindow(c === true)}
              />
              <Label htmlFor="promo-daily-window" className="cursor-pointer font-normal">
                Chỉ áp dụng theo khung giờ vàng trong ngày
              </Label>
            </div>
            {hasDailyWindow && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-daily-start">Từ giờ</Label>
                  <Input
                    id="promo-daily-start"
                    type="time"
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-daily-end">Đến giờ</Label>
                  <Input
                    id="promo-daily-end"
                    type="time"
                    value={dailyEndTime}
                    onChange={(e) => setDailyEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Áp dụng mỗi ngày trong khoảng thời gian hiệu lực ở trên (vd 14:00–16:00 mỗi ngày). Chưa hỗ trợ khung giờ
              qua đêm (vd 22:00–02:00).
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
