"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSmartInsights } from "@/hooks/useSmartInsights";
import { cn } from "@/lib/utils";
import type { SmartInsightTone } from "@/types";
import { Info, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TONE_ICON: Record<SmartInsightTone, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Info,
};

const TONE_CLASS: Record<SmartInsightTone, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
  neutral: "text-primary bg-primary/10",
};

/**
 * "Nhận định thông minh" (Module 10) — tự động so sánh tuần này với tuần
 * trước bằng LUẬT CỐ ĐỊNH (rules-based text generation), KHÔNG gọi mô hình AI
 * nào dù đặt tên "Smart" theo đúng yêu cầu nghiệp vụ ban đầu. Xem
 * `analytics.service.ts#getSmartInsights` để biết chi tiết từng nhận định.
 */
export function SmartInsightsCard() {
  const { insights, loading } = useSmartInsights();

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Nhận định thông minh</h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight) => {
            const Icon = TONE_ICON[insight.tone];
            return (
              <li key={insight.id} className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-2.5 text-sm">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    TONE_CLASS[insight.tone]
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="pt-0.5">{insight.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
