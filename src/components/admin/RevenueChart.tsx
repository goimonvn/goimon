"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { useRevenueSeries } from "@/hooks/useRevenueSeries";
import type { RevenueRange } from "@/types";
import { Table2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Màu chủ đạo của app (--primary: hsl(24 65% 33%)) quy đổi sang hex — biểu đồ
// 1 chuỗi số liệu (doanh thu) nên dùng đúng 1 tông màu (sequential single-hue),
// không dùng thang màu nhiều tông theo quy tắc dataviz đã thống nhất.
const REVENUE_HUE = "#8b491d";

const RANGE_OPTIONS: { value: RevenueRange; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày qua" },
];

/** Rút gọn số tiền cho trục Y, ví dụ 1.500.000 -> "1,5tr", 250.000 -> "250k". */
function formatCompactVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${value}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-sm shadow-md">
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

/**
 * Biểu đồ doanh thu theo giờ (hôm nay) hoặc theo ngày (7 ngày qua). Một chuỗi
 * số liệu duy nhất -> không cần chú giải (legend), tiêu đề đã nói rõ đang
 * xem gì. Có nút "Xem dạng bảng" để đảm bảo mọi giá trị đều đọc được không
 * chỉ qua tooltip (bản song sinh dạng bảng theo yêu cầu tiếp cận).
 */
export function RevenueChart() {
  const [range, setRange] = useState<RevenueRange>("today");
  const [showTable, setShowTable] = useState(false);
  const { points, loading } = useRevenueSeries(range);

  const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Doanh thu</h2>
          <p className="text-sm text-muted-foreground">
            Tổng {range === "today" ? "hôm nay" : "7 ngày qua"}:{" "}
            <span className="font-medium text-foreground">{formatCurrency(totalRevenue)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-xl bg-muted p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  range === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
              showTable ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"
            )}
            title="Xem dạng bảng"
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : showTable ? (
        <div className="max-h-64 overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{range === "today" ? "Giờ" : "Ngày"}</th>
                <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.label} className="border-t">
                  <td className="px-3 py-2">{point.label}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(point.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="hsl(24 15% 88%)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }}
              interval={range === "today" ? 1 : 0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }}
              tickFormatter={formatCompactVnd}
            />
            <Tooltip cursor={{ fill: "hsl(24 20% 92%)" }} content={<ChartTooltip />} />
            <Bar dataKey="revenue" fill={REVENUE_HUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
