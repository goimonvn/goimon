"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ANALYTICS_PRESET_LABEL, type AnalyticsPreset } from "@/types";
import { Download } from "lucide-react";

interface AnalyticsFilterBarProps {
  preset: AnalyticsPreset;
  onPresetChange: (preset: AnalyticsPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onExportCsv: () => void;
  exportDisabled?: boolean;
}

const PRESETS: AnalyticsPreset[] = ["today", "7d", "month", "custom"];

/** Thanh lọc thời gian cho `/admin/analytics` — 3 khoảng dựng sẵn + tuỳ chỉnh ngày, cộng nút xuất CSV. */
export function AnalyticsFilterBar({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onExportCsv,
  exportDisabled,
}: AnalyticsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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
      <Button type="button" variant="outline" size="sm" onClick={onExportCsv} disabled={exportDisabled}>
        <Download className="h-4 w-4" />
        Xuất CSV
      </Button>
    </div>
  );
}
