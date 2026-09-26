"use client";

import { AnalyticsFilterBar } from "@/components/admin/AnalyticsFilterBar";
import { HourlyHeatmap } from "@/components/admin/HourlyHeatmap";
import { StatCard } from "@/components/admin/StatCard";
import { TopItemsTable } from "@/components/admin/TopItemsTable";
import { WeekdayRevenueChart } from "@/components/admin/WeekdayRevenueChart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsReport } from "@/hooks/useAnalyticsReport";
import { usePageTitle } from "@/hooks/usePageTitle";
import { exportAccountingExcel, exportAccountingPdf } from "@/lib/accountingExport";
import { resolveAnalyticsRange } from "@/lib/analytics";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { formatCurrency } from "@/lib/utils";
import { getAccountingReport } from "@/services/analytics.service";
import type { AnalyticsPreset } from "@/types";
import { ClipboardList, Repeat, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Trang báo cáo phân tích chi tiết (Module 10) — khác với `/admin/dashboard`
 * (luôn "hôm nay"/toàn bộ lịch sử, không lọc được), trang này cho phép chủ
 * quán chọn khoảng thời gian (hôm nay/7 ngày/tháng này/tuỳ chỉnh) để xem lại
 * AOV, tỷ lệ khách quay lại, xu hướng doanh thu theo thứ, khung giờ vàng và
 * top món bán chạy — kèm xuất CSV để lưu Excel.
 */
export default function AdminAnalyticsPage() {
  usePageTitle("Phân tích & Báo cáo");
  const [preset, setPreset] = useState<AnalyticsPreset>("7d");
  const [customFrom, setCustomFrom] = useState(todayIsoDate());
  const [customTo, setCustomTo] = useState(todayIsoDate());

  const range = useMemo(
    () => resolveAnalyticsRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const { report, loading } = useAnalyticsReport(range);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  /**
   * Xuất Excel/PDF (Module 21) — tải riêng `getAccountingReport` (dữ liệu
   * khác `report` đang hiển thị trên trang: doanh thu theo TỪNG NGÀY, chi
   * phí, phương thức thanh toán, hoá đơn VAT) NGAY LÚC bấm nút thay vì tải
   * sẵn liên tục như `report` — dữ liệu này chỉ dùng để xuất file, không hiển
   * thị trực tiếp trên trang nên không cần load-eager theo mọi lần đổi bộ lọc.
   */
  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const accountingReport = await getAccountingReport(range);
      await exportAccountingExcel(accountingReport, `bao-cao-ke-toan-goimon-${todayIsoDate()}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xuất báo cáo Excel.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const accountingReport = await getAccountingReport(range);
      await exportAccountingPdf(accountingReport, `bao-cao-ke-toan-goimon-${todayIsoDate()}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xuất báo cáo PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  function handleExportCsv() {
    if (!report) return;

    const rows: (string | number)[][] = [
      ["Báo cáo phân tích Gọi Món", todayIsoDate()],
      [],
      ["Chỉ số", "Giá trị"],
      ["Tổng doanh thu (đã thanh toán)", report.metrics.revenueTotal],
      ["Số đơn", report.metrics.ordersCount],
      ["Số đơn đã thanh toán", report.metrics.paidOrdersCount],
      ["Giá trị trung bình mỗi hoá đơn (AOV)", report.metrics.averageOrderValue],
      ["Tỷ lệ khách quay lại (%)", report.metrics.retentionRate],
      ["Khách quay lại", report.metrics.returningCustomers],
      ["Khách mới", report.metrics.newCustomers],
      [],
      ["Doanh thu theo thứ trong tuần"],
      ["Thứ", "Doanh thu"],
      ...report.weekdayTrend.map((p) => [p.label, p.revenue]),
      [],
      ["Món bán chạy"],
      ["Món", "Số lượng", "Doanh thu ước tính"],
      ...report.topItems.map((item) => [item.name, item.quantity, item.revenue]),
    ];

    downloadCsv(`bao-cao-goimon-${todayIsoDate()}.csv`, buildCsv(rows));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Phân tích & Báo cáo</h1>
        <p className="text-sm text-muted-foreground">Số liệu kinh doanh chuyên sâu theo khoảng thời gian tuỳ chọn.</p>
      </div>

      <AnalyticsFilterBar
        preset={preset}
        onPresetChange={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onExportCsv={handleExportCsv}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        exportDisabled={!report || loading}
        exportingExcel={exportingExcel}
        exportingPdf={exportingPdf}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !report ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Doanh thu" value={formatCurrency(report.metrics.revenueTotal)} icon={Wallet} />
            <StatCard label="Số đơn" value={`${report.metrics.ordersCount}`} icon={ClipboardList} />
            <StatCard
              label="Giá trị TB / hoá đơn"
              value={formatCurrency(report.metrics.averageOrderValue)}
              icon={TrendingUp}
            />
            <StatCard
              label="Tỷ lệ khách quay lại"
              value={report.metrics.totalCustomersInRange > 0 ? `${report.metrics.retentionRate}%` : "Chưa có dữ liệu"}
              icon={Repeat}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WeekdayRevenueChart points={report?.weekdayTrend ?? []} loading={loading} />
        <TopItemsTable rows={report?.topItems ?? []} loading={loading} />
      </div>

      <HourlyHeatmap cells={report?.heatmap ?? []} loading={loading} />
    </div>
  );
}
