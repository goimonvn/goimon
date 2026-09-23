"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SHOP_HOUR_RANGE } from "@/lib/analytics";
import { WEEKDAY_LABELS, type HeatmapCell } from "@/types";

interface HourlyHeatmapProps {
  cells: HeatmapCell[];
  loading: boolean;
}

const HOURS = Array.from(
  { length: SHOP_HOUR_RANGE.end - SHOP_HOUR_RANGE.start + 1 },
  (_, i) => SHOP_HOUR_RANGE.start + i
);

// Cùng tông màu doanh thu (#8b491d) với các biểu đồ khác — heatmap là số liệu
// MỘT CHUỖI (số lượt đặt), theo quy tắc dataviz "sequential = 1 hue, sáng ->
// đậm", KHÔNG dùng thang màu nhiều tông (rainbow).
const HEAT_HUE_RGB = "139, 73, 29";

function cellAlpha(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return 0.12 + (count / max) * 0.78;
}

/**
 * Heatmap "khung giờ vàng" (Module 10) — 7 hàng (Thứ 2 -> CN) x các khung giờ
 * hoạt động của quán (`SHOP_HOUR_RANGE`), tô đậm theo số LƯỢT ĐẶT MÓN (không
 * lọc theo trạng thái thanh toán — đo lưu lượng khách ghé/gọi món, khác bản
 * chất với biểu đồ doanh thu bên cạnh). Mỗi ô có `title`/`aria-label` đọc
 * được số liệu chính xác khi rê chuột/dùng trình đọc màn hình, thay cho bảng
 * dữ liệu song sinh (lưới 7x17 ô hiển thị bảng sẽ quá rối, không giúp ích).
 */
export function HourlyHeatmap({ cells, loading }: HourlyHeatmapProps) {
  const maxCount = Math.max(0, ...cells.map((c) => c.orderCount));
  const cellByKey = new Map(cells.map((c) => [`${c.weekdayIndex}-${c.hour}`, c.orderCount]));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold">Khung giờ vàng</h2>
        {maxCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Ít</span>
            <span
              className="h-2.5 w-16 rounded-full"
              style={{
                background: `linear-gradient(to right, rgba(${HEAT_HUE_RGB}, 0.12), rgba(${HEAT_HUE_RGB}, 0.9))`,
              }}
            />
            <span>Nhiều</span>
          </div>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Số lượt đặt món theo thứ và khung giờ trong ngày</p>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : maxCount === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có đơn hàng trong khoảng thời gian đã chọn.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="w-14" />
                {HOURS.map((hour) => (
                  <th key={hour} className="pb-1 text-center text-[10px] font-normal text-muted-foreground">
                    {hour % 2 === 0 ? hour : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABELS.map((label, weekdayIndex) => (
                <tr key={label}>
                  <td className="whitespace-nowrap pr-2 text-right text-xs text-muted-foreground">{label}</td>
                  {HOURS.map((hour) => {
                    const count = cellByKey.get(`${weekdayIndex}-${hour}`) ?? 0;
                    return (
                      <td key={hour} className="p-0">
                        <div
                          className="h-5 w-5 rounded-[4px] sm:h-6 sm:w-6"
                          style={{
                            backgroundColor:
                              count > 0 ? `rgba(${HEAT_HUE_RGB}, ${cellAlpha(count, maxCount)})` : "hsl(24 20% 95%)",
                          }}
                          title={`${label} ${hour}:00 — ${count} lượt đặt`}
                          aria-label={`${label} ${hour} giờ: ${count} lượt đặt món`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
