"use client";

import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { Button } from "@/components/ui/button";
import type { AnalyticsPreset } from "@/types";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface AnalyticsFilterBarProps {
  preset: AnalyticsPreset;
  onPresetChange: (preset: AnalyticsPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exportDisabled?: boolean;
  /** Module 21: xuất Excel/PDF cần gọi thêm 1 lượt tải dữ liệu + (với PDF) tải font, có thể mất vài giây — hiện trạng thái riêng cho từng nút thay vì khoá cả 3. */
  exportingExcel?: boolean;
  exportingPdf?: boolean;
}

/**
 * Thanh lọc thời gian cho `/admin/analytics` — bộ lọc khoảng ngày dùng chung
 * (`DateRangeFilter`) + 3 nút xuất báo cáo: CSV thô (Module 10, dữ liệu tổng
 * hợp/xu hướng hiển thị trên chính trang này) và Excel/PDF (Module 21, báo
 * cáo kế toán đầy đủ hơn — doanh thu theo ngày, chi phí, phương thức thanh
 * toán, hoá đơn VAT — tiện gửi thẳng cho kế toán quán) — cả 3 cùng tồn tại
 * song song, không thay thế nhau.
 */
export function AnalyticsFilterBar({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onExportCsv,
  onExportExcel,
  onExportPdf,
  exportDisabled,
  exportingExcel,
  exportingPdf,
}: AnalyticsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <DateRangeFilter
        preset={preset}
        onPresetChange={onPresetChange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={onCustomFromChange}
        onCustomToChange={onCustomToChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExportCsv} disabled={exportDisabled}>
          <Download className="h-4 w-4" />
          Xuất CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={exportDisabled || exportingExcel}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exportingExcel ? "Đang xuất..." : "Xuất Excel"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onExportPdf} disabled={exportDisabled || exportingPdf}>
          <FileText className="h-4 w-4" />
          {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
        </Button>
      </div>
    </div>
  );
}
