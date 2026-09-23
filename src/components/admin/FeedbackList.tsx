"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FEEDBACK_CRITERIA_LABEL, type FeedbackWithOrder } from "@/types";
import { Star } from "lucide-react";

interface FeedbackListProps {
  feedbacks: FeedbackWithOrder[];
  loading: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StarsCell({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {value}
      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
    </span>
  );
}

/** Danh sách đánh giá của khách — mới nhất trước, tự cập nhật realtime (xem useFeedbacks). */
export function FeedbackList({ feedbacks, loading }: FeedbackListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (feedbacks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có đánh giá nào từ khách hàng.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Thời gian</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Bàn</th>
            <th className="px-4 py-3 font-medium">{FEEDBACK_CRITERIA_LABEL.ratingBeverage}</th>
            <th className="px-4 py-3 font-medium">{FEEDBACK_CRITERIA_LABEL.ratingService}</th>
            <th className="px-4 py-3 font-medium">{FEEDBACK_CRITERIA_LABEL.ratingSpace}</th>
            <th className="px-4 py-3 font-medium">Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {feedbacks.map((feedback) => (
            <tr key={feedback.id} className="border-t align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDateTime(feedback.created_at)}
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                {feedback.order?.table_number != null ? `Bàn ${feedback.order.table_number}` : "—"}
              </td>
              <td className="px-4 py-3">
                <StarsCell value={feedback.rating_beverage} />
              </td>
              <td className="px-4 py-3">
                <StarsCell value={feedback.rating_service} />
              </td>
              <td className="px-4 py-3">
                <StarsCell value={feedback.rating_space} />
              </td>
              <td className="max-w-xs px-4 py-3 text-muted-foreground">
                {feedback.comment ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
