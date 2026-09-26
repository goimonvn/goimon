"use client";

import { FeedbackList } from "@/components/admin/FeedbackList";
import { StatCard } from "@/components/admin/StatCard";
import { useFeedbacks } from "@/hooks/useFeedbacks";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Armchair, Coffee, Headphones } from "lucide-react";
import { useMemo } from "react";

function average(values: number[]): string {
  if (values.length === 0) return "—";
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
}

/** Trang đánh giá của khách (Module 5) — chủ quán xem điểm trung bình 3 hạng mục + danh sách chi tiết, tự cập nhật realtime. */
export default function AdminFeedbacksPage() {
  usePageTitle("Đánh giá của khách hàng");
  const { feedbacks, loading } = useFeedbacks();

  const averages = useMemo(
    () => ({
      beverage: average(feedbacks.map((f) => f.rating_beverage)),
      service: average(feedbacks.map((f) => f.rating_service)),
      space: average(feedbacks.map((f) => f.rating_space)),
    }),
    [feedbacks]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Đánh giá của khách hàng</h1>
        <p className="text-sm text-muted-foreground">
          Đánh giá nhanh (1-5 sao) khách gửi sau khi bàn hoàn tất thanh toán.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Đồ uống (TB)" value={`${averages.beverage}/5`} icon={Coffee} />
        <StatCard label="Phục vụ (TB)" value={`${averages.service}/5`} icon={Headphones} />
        <StatCard label="Không gian (TB)" value={`${averages.space}/5`} icon={Armchair} />
      </div>

      <FeedbackList feedbacks={feedbacks} loading={loading} />
    </div>
  );
}
