"use client";

import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { StaffPerformanceChart } from "@/components/admin/StaffPerformanceChart";
import { StaffPerformanceTable } from "@/components/admin/StaffPerformanceTable";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useStaffPerformance } from "@/hooks/useStaffPerformance";
import { resolveAnalyticsRange } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsPreset } from "@/types";
import { ClipboardList, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * So sánh hiệu suất nhân viên (Module 21) — doanh thu/số đơn đã xử lý mỗi ca,
 * đối chiếu với dữ liệu ca làm việc (Module 8), theo khoảng thời gian tuỳ
 * chọn (dùng lại đúng `DateRangeFilter`/`resolveAnalyticsRange` của
 * `/admin/analytics`, Module 10). Dùng cho chủ quán đánh giá ai đang phục vụ
 * hiệu quả nhất trong 1 kỳ nhất định — KHÔNG dùng để tính lương/thưởng tự
 * động (dự án chưa có luồng đó).
 */
export default function AdminStaffPerformancePage() {
  usePageTitle("Hiệu suất nhân viên");
  const [preset, setPreset] = useState<AnalyticsPreset>("7d");
  const [customFrom, setCustomFrom] = useState(todayIsoDate());
  const [customTo, setCustomTo] = useState(todayIsoDate());

  const range = useMemo(
    () => resolveAnalyticsRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const { rows, loading } = useStaffPerformance(range);

  const totalRevenue = rows.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.totalOrders, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Hiệu suất nhân viên</h1>
        <p className="text-sm text-muted-foreground">
          So sánh doanh thu và số đơn đã xử lý mỗi ca giữa các nhân viên, đối chiếu dữ liệu ca làm việc.
        </p>
      </div>

      <DateRangeFilter
        preset={preset}
        onPresetChange={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Số nhân viên có ca" value={`${rows.length}`} icon={Users} />
            <StatCard
              label="Tổng doanh thu (xác nhận tại quầy)"
              value={formatCurrency(totalRevenue)}
              icon={Wallet}
            />
            <StatCard label="Tổng số đơn đã xử lý" value={`${totalOrders}`} icon={ClipboardList} />
          </>
        )}
      </div>

      <StaffPerformanceChart rows={rows} loading={loading} />
      <StaffPerformanceTable rows={rows} loading={loading} />

      <p className="text-xs italic text-muted-foreground">
        * Chỉ tính đơn được nhân viên xác nhận thanh toán tại quầy (gắn ca làm việc) — đơn giao tận nơi/PayOS tự
        động không gắn ca nào nên không nằm trong so sánh này (xem thêm ở trang Phân tích &amp; Báo cáo).
      </p>
    </div>
  );
}
