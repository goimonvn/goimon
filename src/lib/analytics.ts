import type { AnalyticsDateRange, AnalyticsPreset } from "@/types";

/**
 * Khung giờ hoạt động điển hình của quán cà phê (6h-22h) — dùng chung cho
 * biểu đồ doanh thu theo giờ (Module 3, `analytics.service.getRevenueSeries`)
 * và heatmap khung giờ vàng (Module 10), tránh định nghĩa trùng 2 nơi.
 */
export const SHOP_HOUR_RANGE = { start: 6, end: 22 } as const;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Thứ trong tuần theo quy ước Việt Nam (Thứ 2 đứng đầu tuần) — khác với
 * `Date.getDay()` gốc của JS (0 = Chủ Nhật đứng đầu). Trả về 0 = Thứ 2 ...
 * 6 = Chủ Nhật, khớp với thứ tự của `WEEKDAY_LABELS` ở `types/index.ts`.
 */
export function mondayFirstWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Quy đổi 1 trong 4 lựa chọn lọc thời gian ở `/admin/analytics` thành khoảng
 * ngày cụ thể — tính theo giờ địa phương TRÌNH DUYỆT, giống quy ước "quán chỉ
 * vận hành 1 múi giờ duy nhất" đã dùng ở `analytics.service.getDashboardSummary`,
 * không xử lý múi giờ phức tạp ở tầng này. "Tuỳ chỉnh" nhận 2 chuỗi ngày dạng
 * "yyyy-MM-dd" (giá trị gốc của `<input type="date">`).
 */
export function resolveAnalyticsRange(
  preset: AnalyticsPreset,
  customFrom?: string,
  customTo?: string
): AnalyticsDateRange {
  const now = new Date();

  if (preset === "today") {
    return { from: startOfDay(now), to: now };
  }

  if (preset === "7d") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return { from, to: now };
  }

  if (preset === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }

  // custom
  const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : startOfDay(now);
  const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : endOfDay(now);
  return { from, to: to < from ? from : to };
}

export interface WeekComparisonRanges {
  currentWeek: AnalyticsDateRange;
  previousWeek: AnalyticsDateRange;
}

/**
 * So sánh "tuần này" với "tuần trước" kiểu APPLES-TO-APPLES: nếu hôm nay là
 * Thứ 4, "tuần này" chỉ tính từ Thứ 2 tới hết Thứ 4 hiện tại (KHÔNG phải cả
 * tuần), và "tuần trước" cũng chỉ lấy đúng Thứ 2 tới Thứ 4 của tuần trước —
 * để không so sánh nhầm 1 tuần chưa trọn vẹn với 1 tuần đã đầy đủ (nếu không
 * sẽ luôn cho ra kết quả "giảm" giả tạo vào đầu tuần).
 */
export function getWeekComparisonRanges(now: Date = new Date()): WeekComparisonRanges {
  const mondayIndex = mondayFirstWeekdayIndex(now);

  const currentWeekStart = startOfDay(now);
  currentWeekStart.setDate(currentWeekStart.getDate() - mondayIndex);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const previousWeekEnd = new Date(now);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

  return {
    currentWeek: { from: currentWeekStart, to: now },
    previousWeek: { from: previousWeekStart, to: previousWeekEnd },
  };
}

export interface PercentChange {
  /** null khi không tính được % (tuần/kỳ so sánh trước = 0). */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

/** So sánh 2 giá trị (thường là doanh thu) và trả về hướng thay đổi + % đã làm tròn 1 chữ số thập phân. */
export function computePercentChange(current: number, previous: number): PercentChange {
  if (previous === 0) {
    return current === 0 ? { pct: 0, direction: "flat" } : { pct: null, direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct: Math.round(pct * 10) / 10, direction };
}

/**
 * Tìm khung 2 giờ liên tiếp có tổng số lượt đặt món cao nhất (cửa sổ trượt,
 * chỉ xét trong `SHOP_HOUR_RANGE`) — dùng để sinh nhận định "Khung giờ cao
 * điểm từ HH:00 đến HH:00". Trả về `null` nếu không có đơn nào.
 */
export function findPeakTwoHourWindow(
  hourlyCounts: Map<number, number>
): { startHour: number; endHour: number } | null {
  let best: { startHour: number; endHour: number; total: number } | null = null;
  for (let h = SHOP_HOUR_RANGE.start; h < SHOP_HOUR_RANGE.end; h += 1) {
    const total = (hourlyCounts.get(h) ?? 0) + (hourlyCounts.get(h + 1) ?? 0);
    if (total > 0 && (!best || total > best.total)) {
      best = { startHour: h, endHour: h + 2, total };
    }
  }
  return best ? { startHour: best.startHour, endHour: best.endHour } : null;
}

export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}
