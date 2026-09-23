"use client";

import { getAllFeedbacks, subscribeToNewFeedbacks } from "@/services/feedback.service";
import type { FeedbackWithOrder } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseFeedbacksResult {
  feedbacks: FeedbackWithOrder[];
  loading: boolean;
}

/** Danh sách đánh giá của khách — tự làm mới ngay khi có đánh giá mới (realtime), dùng cho /admin/feedbacks. */
export function useFeedbacks(): UseFeedbacksResult {
  const [feedbacks, setFeedbacks] = useState<FeedbackWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAllFeedbacks();
        if (!cancelled) setFeedbacks(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách đánh giá.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToNewFeedbacks(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { feedbacks, loading };
}
