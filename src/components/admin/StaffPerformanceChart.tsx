"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { StaffPerformanceRow } from "@/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Cùng tông màu thương hiệu đã dùng cho RevenueChart (Module 3) — biểu đồ so
// sánh 1 chỉ số (doanh thu) giữa các nhân viên, KHÔNG phải nhiều chuỗi số
// liệu khác nhau, nên vẫn dùng đúng 1 hue duy nhất (nhãn trục X đã đủ phân
// biệt từng nhân viên) thay vì gán màu categorical cho từng cột.
const REVENUE_HUE = "#8b491d";

interface StaffPerformanceChartProps {
  rows: StaffPerformanceRow[];
  loading: boolean;
}

/** Rút gọn tên hiển thị trên trục X nếu quá dài (giữ từ đầu tiên + chữ cái đầu họ tên còn lại), tránh chồng chéo nhãn khi có nhiều nhân viên. */
function shortenName(name: string): string {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

function formatCompactVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${value}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: StaffPerformanceRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-sm shadow-md">
      {/* Tên đầy đủ (không rút gọn) — khác nhãn trục X vốn có thể bị cắt bớt để tránh chồng chéo. */}
      <p className="mb-0.5 text-xs text-muted-foreground">{row.staffName}</p>
      <p className="font-semibold text-foreground">{formatCurrency(row.totalRevenue)}</p>
      <p className="text-xs text-muted-foreground">
        {row.shiftsCount} ca · {row.totalOrders} đơn
      </p>
    </div>
  );
}

/** Biểu đồ so sánh doanh thu giữa các nhân viên trong khoảng thời gian đã lọc — mới nhất/cao nhất đứng trước (dữ liệu đã được `getStaffPerformance` sắp xếp giảm dần theo doanh thu). */
export function StaffPerformanceChart({ rows, loading }: StaffPerformanceChartProps) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-1 text-base font-semibold">Doanh thu theo nhân viên</h2>
      <p className="mb-4 text-sm text-muted-foreground">Trong khoảng thời gian đã lọc, xếp theo doanh thu giảm dần</p>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có ca làm việc nào trong khoảng thời gian đã chọn.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows.map((row) => ({ ...row, displayName: shortenName(row.staffName) }))}
            margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
            barCategoryGap="24%"
          >
            <CartesianGrid vertical={false} stroke="hsl(24 15% 88%)" strokeDasharray="0" />
            <XAxis
              dataKey="displayName"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 12, fill: "hsl(24 8% 45%)" }}
              tickFormatter={formatCompactVnd}
            />
            <Tooltip cursor={{ fill: "hsl(24 20% 92%)" }} content={<ChartTooltip />} />
            <Bar dataKey="totalRevenue" fill={REVENUE_HUE} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
