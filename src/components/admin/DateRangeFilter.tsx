"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ANALYTICS_PRESET_LABEL, type AnalyticsPreset } from "@/types";

interface DateRangeFilterProps {
  preset: AnalyticsPreset;
  onPresetChange: (preset: AnalyticsPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

const PRESETS: AnalyticsPreset[] = ["today", "7d", "month", "custom"];

/**
 * Bộ lọc khoảng thời gian dùng chung (3 khoảng dựng sẵn + tuỳ chỉnh ngày) —
 * tách ra từ `AnalyticsFilterBar` (Module 10) để `/admin/staff-performance`
 * (Module 21) dùng lại đúng UI/hành vi thay vì viết trùng; `AnalyticsFilterBar`
 * nay chỉ còn thêm phần nút xuất báo cáo bên cạnh component này.
 */
export function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-muted p-1">
        {PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPresetChange(value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              preset === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {ANALYTICS_PRESET_LABEL[value]}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-9 w-40"
          />
          <span className="text-sm text-muted-foreground">đến</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      )}
    </div>
  );
}
