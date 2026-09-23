"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/services/feedback.service";
import { FEEDBACK_CRITERIA_LABEL } from "@/types";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FeedbackFormProps {
  orderId: string;
  tableNumber: number;
  onSubmitted: () => void;
}

interface StarPickerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function StarPicker({ label, value, onChange }: StarPickerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" aria-label={`${star} sao`} onClick={() => onChange(star)} className="p-1">
            <Star
              className={`h-7 w-7 ${star <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Form đánh giá nhanh sau khi bàn hoàn tất thanh toán (xem status/page.tsx —
 * chỉ hiện khi KHÔNG còn đơn đang hoạt động, CÓ đơn đã completed, và đơn đó
 * CHƯA có feedback). Bắt buộc chấm đủ 3 hạng mục, nhận xét tự do là tuỳ chọn.
 */
export function FeedbackForm({ orderId, tableNumber, onSubmitted }: FeedbackFormProps) {
  const [ratingBeverage, setRatingBeverage] = useState(0);
  const [ratingService, setRatingService] = useState(0);
  const [ratingSpace, setRatingSpace] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (ratingBeverage === 0 || ratingService === 0 || ratingSpace === 0) {
      toast.error("Vui lòng chấm đủ 3 hạng mục trước khi gửi.");
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({ orderId, ratingBeverage, ratingService, ratingSpace, comment, tableNumber });
      toast.success("Cảm ơn bạn đã đánh giá!");
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">Cảm ơn quý khách!</h2>
        <p className="text-sm text-muted-foreground">
          Vui lòng dành chút thời gian đánh giá trải nghiệm hôm nay.
        </p>
      </div>

      <StarPicker label={FEEDBACK_CRITERIA_LABEL.ratingBeverage} value={ratingBeverage} onChange={setRatingBeverage} />
      <StarPicker label={FEEDBACK_CRITERIA_LABEL.ratingService} value={ratingService} onChange={setRatingService} />
      <StarPicker label={FEEDBACK_CRITERIA_LABEL.ratingSpace} value={ratingSpace} onChange={setRatingSpace} />

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Góp ý thêm (không bắt buộc)</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn..."
          rows={3}
        />
      </div>

      <Button size="lg" className="w-full" disabled={submitting} onClick={() => void handleSubmit()}>
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </Button>
    </div>
  );
}
