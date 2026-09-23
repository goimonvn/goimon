"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { WeekdayRevenuePoint } from "@/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Cùng tông màu doanh thu (#8b491d) với RevenueChart (Module 3) — 1 chuỗi số
// liệu duy nhất nên dùng đúng 1 hue (sequential single-hue) theo quy tắc dataviz.
const REVENUE_HUE = "#8b491d";

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

interface WeekdayRevenueChartProps {
  points: WeekdayRevenuePoint[];
  loading: boolean;
}

/**
 * Xu hướng doanh thu theo thứ trong tuần (Module 10) — gộp TRONG khoảng thời
 * gian đang lọc ở `/admin/analytics`, giúp chủ quán biết thứ nào đông khách
 * nhất. Chỉ tính đơn đã thanh toán, khớp quy ước với `RevenueChart` (Module 3).
 */
export function WeekdayRevenueChart({ points, loading }: WeekdayRevenueChartProps) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-1 text-base font-semibold">Doanh thu theo thứ trong tuần</h2>
      <p className="mb-4 text-sm text-muted-foreground">Gộp theo Thứ 2 → Chủ Nhật trong khoảng thời gian đã lọc</p>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="hsl(24 15% 88%)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }}
              tickFormatter={formatCompactVnd}
            />
            <Tooltip cursor={{ fill: "hsl(24 20% 92%)" }} content={<ChartTooltip />} />
            <Bar dataKey="revenue" fill={REVENUE_HUE} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
