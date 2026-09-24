import { supabase } from "@/lib/supabase/client";
import {
  computePercentChange,
  findPeakTwoHourWindow,
  formatHour,
  getWeekComparisonRanges,
  mondayFirstWeekdayIndex,
  shopDateString,
  SHOP_HOUR_RANGE,
} from "@/lib/analytics";
import { getTotalExpenses } from "./expense.service";
import {
  AppError,
  WEEKDAY_LABELS,
  type AdvancedMetrics,
  type AnalyticsDateRange,
  type AnalyticsReport,
  type BestSellerRow,
  type DashboardSummary,
  type HeatmapCell,
  type RevenuePoint,
  type RevenueRange,
  type SmartInsight,
  type WeekdayRevenuePoint,
} from "@/types";
import type { TablesRow, TableStatus } from "@/types/database.types";

const EMPTY_TABLE_STATUS_COUNTS: Record<TableStatus, number> = {
  empty: 0,
  ordering: 0,
  paid: 0,
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Số liệu tổng quan cho 4 thẻ thống kê đầu trang Dashboard. "Hôm nay" tính
 * theo NGÀY DƯƠNG LỊCH của trình duyệt (giờ địa phương quán), dựa trên
 * `created_at` — quán vận hành 1 múi giờ duy nhất nên cách này đơn giản và
 * đủ chính xác, không cần xử lý múi giờ phức tạp ở tầng DB.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const todayIso = startOfToday().toISOString();
  // Chi phí (Module 12) lọc theo cột DATE `expense_date`, không phải
  // `created_at` — dùng `shopDateString()` (giờ quán Asia/Ho_Chi_Minh tường
  // minh, xem lib/analytics.ts) thay vì tự suy ra "yyyy-MM-dd" từ `todayIso`
  // (một chuỗi ISO theo giờ UTC sẽ lệch ngày nếu tự cắt chuỗi).
  const todayDateStr = shopDateString();

  const [ordersRes, vatRes, tablesRes, totalExpensesToday] = await Promise.all([
    supabase.from("orders").select("total_amount, payment_status").gte("created_at", todayIso),
    supabase.from("vat_invoices").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("tables").select("status"),
    getTotalExpenses(todayDateStr, todayDateStr),
  ]);

  if (ordersRes.error || vatRes.error || tablesRes.error) {
    throw new AppError(
      "Không thể tải số liệu tổng quan.",
      ordersRes.error ?? vatRes.error ?? tablesRes.error
    );
  }

  const revenueToday = (ordersRes.data ?? [])
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total_amount, 0);

  const tableStatusCounts: Record<TableStatus, number> = { ...EMPTY_TABLE_STATUS_COUNTS };
  // Ép kiểu tường minh — Database type viết tay không suy luận chính xác kiểu
  // hẹp khi .select() chỉ định 1 cột duy nhất dạng chuỗi ("status"), khiến
  // `table` sụp thành `any` (xem ghi chú tương tự ở order.service.ts và
  // vatInvoice.service.ts). `any` không được dùng làm index cho
  // `Record<TableStatus, number>` (kiểu có key hữu hạn, không phải index
  // signature) nên bắt buộc phải ép kiểu tường minh ở đây.
  const tableRows = (tablesRes.data ?? []) as unknown as Pick<TablesRow, "status">[];
  for (const table of tableRows) {
    tableStatusCounts[table.status] += 1;
  }

  return {
    revenueToday,
    ordersToday: ordersRes.data?.length ?? 0,
    vatInvoicesToday: vatRes.count ?? 0,
    tableStatusCounts,
    totalExpensesToday,
    // CHỈ mang tính ước tính vận hành trong ngày — chưa trừ các chi phí cố
    // định phân bổ hàng ngày (mặt bằng, khấu hao thiết bị...) nếu quán không
    // ghi nhận chúng qua `/admin/expenses` theo từng ngày.
    grossProfitToday: revenueToday - totalExpensesToday,
  };
}

// Khung giờ hoạt động điển hình của quán cà phê — dùng chung với heatmap
// "khung giờ vàng" (Module 10), xem lib/analytics.ts#SHOP_HOUR_RANGE.
const TODAY_HOUR_RANGE = SHOP_HOUR_RANGE;

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/**
 * Doanh thu theo giờ (hôm nay, 6h-22h) hoặc theo ngày (7 ngày gần nhất, kể cả
 * hôm nay). Chỉ tính các đơn đã `payment_status = 'paid'` — khớp với cách
 * tính `revenueToday` ở trên, tránh 2 số liệu "doanh thu" lệch nhau trên cùng
 * 1 dashboard. Gộp theo bucket ở tầng client vì khối lượng đơn/ngày của 1
 * quán 15 bàn rất nhỏ, không cần view/RPC riêng ở Postgres.
 */
export async function getRevenueSeries(range: RevenueRange): Promise<RevenuePoint[]> {
  const rangeStart =
    range === "today"
      ? startOfToday()
      : (() => {
          const d = startOfToday();
          d.setDate(d.getDate() - 6);
          return d;
        })();

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, payment_status, created_at")
    .gte("created_at", rangeStart.toISOString());

  if (error) {
    throw new AppError("Không thể tải biểu đồ doanh thu.", error);
  }

  const paidOrders = (data ?? []).filter((o) => o.payment_status === "paid");

  if (range === "today") {
    const buckets = new Map<number, number>();
    for (let hour = TODAY_HOUR_RANGE.start; hour <= TODAY_HOUR_RANGE.end; hour += 1) {
      buckets.set(hour, 0);
    }
    for (const order of paidOrders) {
      const hour = new Date(order.created_at).getHours();
      if (buckets.has(hour)) {
        buckets.set(hour, (buckets.get(hour) ?? 0) + order.total_amount);
      }
    }
    return Array.from(buckets.entries()).map(([hour, revenue]) => ({
      label: `${hour.toString().padStart(2, "0")}:00`,
      revenue,
    }));
  }

  const buckets = new Map<string, { label: string; revenue: number }>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const key = d.toDateString();
    buckets.set(key, { label: formatDayLabel(d), revenue: 0 });
  }
  for (const order of paidOrders) {
    const key = new Date(order.created_at).toDateString();
    const bucket = buckets.get(key);
    if (bucket) bucket.revenue += order.total_amount;
  }
  return Array.from(buckets.values());
}

/**
 * Top món bán chạy theo tổng `quantity` trong order_items (toàn bộ lịch sử).
 *
 * LƯU Ý: order_items không lưu đơn giá tại thời điểm đặt (đúng theo schema
 * gốc), nên `revenue` ở đây = quantity * GIÁ HIỆN TẠI của món, chỉ mang tính
 * ước tính tham khảo — không phải doanh thu lịch sử chính xác (khác với
 * `revenueToday`/`getRevenueSeries` vốn lấy thẳng từ `orders.total_amount`
 * đã chốt tại thời điểm tạo đơn).
 */
export async function getBestSellers(limit = 10): Promise<BestSellerRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity, menu_item:menu_items(name, price)");

  if (error) {
    throw new AppError("Không thể tải bảng xếp hạng món bán chạy.", error);
  }

  type RawRow = { menu_item_id: string; quantity: number; menu_item: { name: string; price: number } | null };
  const rows = (data ?? []) as unknown as RawRow[];

  const aggregated = new Map<string, BestSellerRow>();
  for (const row of rows) {
    const existing = aggregated.get(row.menu_item_id);
    const price = row.menu_item?.price ?? 0;
    if (existing) {
      existing.quantity += row.quantity;
      existing.revenue += row.quantity * price;
    } else {
      aggregated.set(row.menu_item_id, {
        menuItemId: row.menu_item_id,
        name: row.menu_item?.name ?? "Món đã xoá",
        quantity: row.quantity,
        revenue: row.quantity * price,
      });
    }
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Module 10 — Phân tích dữ liệu nâng cao & Báo cáo kinh doanh thông minh
// ---------------------------------------------------------------------------

type OrderAggRow = {
  customer_id: string | null;
  total_amount: number;
  payment_status: string;
  created_at: string;
};

async function fetchOrdersInRange(range: AnalyticsDateRange): Promise<OrderAggRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("customer_id, total_amount, payment_status, created_at")
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString());

  if (error) {
    throw new AppError("Không thể tải dữ liệu đơn hàng trong khoảng thời gian đã chọn.", error);
  }
  return data ?? [];
}

/**
 * Tỷ lệ khách quay lại (Module 10): với mỗi khách hàng thân thiết (định danh
 * bằng SĐT qua `customer_id` — Module 5) từng đặt đơn TRONG khoảng đang xem,
 * kiểm tra xem họ đã có đơn nào TRƯỚC khoảng đó chưa. Muốn vậy cần biết ngày
 * đặt SỚM NHẤT của từng khách trên TOÀN BỘ lịch sử (không giới hạn theo
 * range) — chỉ lấy 2 cột (customer_id, created_at) nên nhẹ, chấp nhận được ở
 * quy mô 1 quán 15 bàn (giống cách `getBestSellers` đã quét toàn bộ order_items
 * không phân trang).
 */
async function computeRetention(
  range: AnalyticsDateRange,
  ordersInRange: OrderAggRow[]
): Promise<Pick<AdvancedMetrics, "retentionRate" | "returningCustomers" | "newCustomers" | "totalCustomersInRange">> {
  const customerIdsInRange = new Set(
    ordersInRange.map((o) => o.customer_id).filter((id): id is string => id !== null)
  );

  if (customerIdsInRange.size === 0) {
    return { retentionRate: 0, returningCustomers: 0, newCustomers: 0, totalCustomersInRange: 0 };
  }

  const { data, error } = await supabase.from("orders").select("customer_id, created_at").not("customer_id", "is", null);

  if (error) {
    throw new AppError("Không thể tính tỷ lệ khách quay lại.", error);
  }

  // Ép kiểu qua `unknown` trước (thay vì ép thẳng) — theo đúng quy ước đã
  // dùng ở mọi nơi khác trong file này, tránh lỗi "Conversion... may be a
  // mistake" nếu Database type viết tay suy luận ra 1 kiểu cụ thể (dù sai)
  // thay vì `any` cho .select() cột hẹp này.
  const retentionRows = (data ?? []) as unknown as { customer_id: string | null; created_at: string }[];
  const earliestByCustomer = new Map<string, number>();
  for (const row of retentionRows) {
    if (!row.customer_id) continue;
    const t = new Date(row.created_at).getTime();
    const existing = earliestByCustomer.get(row.customer_id);
    if (existing === undefined || t < existing) earliestByCustomer.set(row.customer_id, t);
  }

  const rangeStart = range.from.getTime();
  let returning = 0;
  for (const customerId of customerIdsInRange) {
    const earliest = earliestByCustomer.get(customerId);
    if (earliest !== undefined && earliest < rangeStart) returning += 1;
  }

  const total = customerIdsInRange.size;
  return {
    retentionRate: Math.round((returning / total) * 1000) / 10,
    returningCustomers: returning,
    newCustomers: total - returning,
    totalCustomersInRange: total,
  };
}

/** Doanh thu gộp theo thứ trong tuần (Thứ 2 -> CN), chỉ tính đơn đã thanh toán — trả về đủ 7 điểm kể cả thứ không có doanh thu (để biểu đồ không bị lệch trục). */
function buildWeekdayTrend(ordersInRange: OrderAggRow[]): WeekdayRevenuePoint[] {
  const totals = new Array(7).fill(0) as number[];
  for (const order of ordersInRange) {
    if (order.payment_status !== "paid") continue;
    // `totals[idx] += ...` không dùng được vì `noUncheckedIndexedAccess` gõ
    // vế đọc `totals[idx]` ra `number | undefined` (không cộng được thẳng) —
    // viết lại thành đọc (kèm `?? 0`) rồi gán riêng, thực tế `idx` luôn nằm
    // trong khoảng 0-6 khớp đúng 7 phần tử của `totals`.
    const idx = mondayFirstWeekdayIndex(new Date(order.created_at));
    totals[idx] = (totals[idx] ?? 0) + order.total_amount;
  }
  // `WEEKDAY_LABELS[weekdayIndex]` gõ ra `string | undefined` vì
  // `noUncheckedIndexedAccess` (weekdayIndex là `number` thường, không phải
  // literal 0-6) — trên thực tế `totals` luôn có đúng 7 phần tử khớp với 7
  // nhãn nên không bao giờ undefined, nhưng vẫn cần `?? ""` để khớp kiểu
  // `label: string` của WeekdayRevenuePoint.
  return totals.map((revenue, weekdayIndex) => ({
    weekdayIndex,
    label: WEEKDAY_LABELS[weekdayIndex] ?? "",
    revenue,
  }));
}

/** Heatmap khung giờ vàng — đếm số lượt đặt món theo (thứ, giờ), không lọc theo trạng thái thanh toán vì đo LƯU LƯỢNG khách, không phải doanh thu. */
function buildHeatmap(ordersInRange: OrderAggRow[]): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const order of ordersInRange) {
    const date = new Date(order.created_at);
    const hour = date.getHours();
    if (hour < SHOP_HOUR_RANGE.start || hour > SHOP_HOUR_RANGE.end) continue;
    const key = `${mondayFirstWeekdayIndex(date)}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex += 1) {
    for (let hour = SHOP_HOUR_RANGE.start; hour <= SHOP_HOUR_RANGE.end; hour += 1) {
      cells.push({ weekdayIndex, hour, orderCount: counts.get(`${weekdayIndex}-${hour}`) ?? 0 });
    }
  }
  return cells;
}

type ItemAggRow = { menu_item_id: string; quantity: number; menu_item: { name: string; price: number } | null };

/** Top món bán chạy TRONG 1 khoảng thời gian cụ thể — tách khỏi `getBestSellers` (luôn all-time, dùng cho Dashboard Module 3) để không đổi hành vi trang đó. */
async function fetchTopItemsInRange(range: AnalyticsDateRange, limit = 10): Promise<BestSellerRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity, created_at, menu_item:menu_items(name, price)")
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString());

  if (error) {
    throw new AppError("Không thể tải danh sách món bán chạy trong khoảng thời gian đã chọn.", error);
  }

  const rows = (data ?? []) as unknown as ItemAggRow[];
  const aggregated = new Map<string, BestSellerRow>();
  for (const row of rows) {
    const existing = aggregated.get(row.menu_item_id);
    const price = row.menu_item?.price ?? 0;
    if (existing) {
      existing.quantity += row.quantity;
      existing.revenue += row.quantity * price;
    } else {
      aggregated.set(row.menu_item_id, {
        menuItemId: row.menu_item_id,
        name: row.menu_item?.name ?? "Món đã xoá",
        quantity: row.quantity,
        revenue: row.quantity * price,
      });
    }
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Báo cáo phân tích chi tiết cho `/admin/analytics` — gộp AOV, tỷ lệ khách
 * quay lại, xu hướng doanh thu theo thứ trong tuần, heatmap khung giờ vàng và
 * top món bán chạy TRONG khoảng thời gian đã lọc. Chạy song song
 * (`Promise.all`) phần không phụ thuộc nhau để giảm độ trễ tải trang; tính
 * retention chờ riêng vì cần biết tập khách hàng trong `ordersInRange` trước.
 */
export async function getAnalyticsReport(range: AnalyticsDateRange): Promise<AnalyticsReport> {
  const [ordersInRange, topItems] = await Promise.all([fetchOrdersInRange(range), fetchTopItemsInRange(range)]);

  const retention = await computeRetention(range, ordersInRange);

  const paidOrders = ordersInRange.filter((o) => o.payment_status === "paid");
  const revenueTotal = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);

  const metrics: AdvancedMetrics = {
    revenueTotal,
    ordersCount: ordersInRange.length,
    paidOrdersCount: paidOrders.length,
    averageOrderValue: paidOrders.length > 0 ? Math.round(revenueTotal / paidOrders.length) : 0,
    ...retention,
  };

  return {
    metrics,
    weekdayTrend: buildWeekdayTrend(ordersInRange),
    heatmap: buildHeatmap(ordersInRange),
    topItems,
  };
}

/**
 * "Nhận định thông minh" (Smart Insights) trên trang chủ Admin Dashboard —
 * sinh nhận định dạng văn bản theo LUẬT CỐ ĐỊNH (rules-based text generation),
 * KHÔNG gọi mô hình AI nào (tên gọi theo đúng yêu cầu nghiệp vụ). So sánh
 * tuần này với tuần trước theo kiểu apples-to-apples (xem
 * `lib/analytics.ts#getWeekComparisonRanges`) để tránh so sánh sai lệch vào
 * đầu tuần (tuần chưa trọn vẹn so với tuần đã đầy đủ).
 */
export async function getSmartInsights(): Promise<SmartInsight[]> {
  const { currentWeek, previousWeek } = getWeekComparisonRanges();

  const [currentOrders, previousOrdersRes, currentItemsRes] = await Promise.all([
    fetchOrdersInRange(currentWeek),
    supabase
      .from("orders")
      .select("total_amount, payment_status")
      .gte("created_at", previousWeek.from.toISOString())
      .lte("created_at", previousWeek.to.toISOString()),
    supabase
      .from("order_items")
      .select("menu_item_id, quantity, created_at, menu_item:menu_items(name)")
      .gte("created_at", currentWeek.from.toISOString())
      .lte("created_at", currentWeek.to.toISOString()),
  ]);

  if (previousOrdersRes.error || currentItemsRes.error) {
    throw new AppError("Không thể tải nhận định thông minh.", previousOrdersRes.error ?? currentItemsRes.error);
  }

  const insights: SmartInsight[] = [];

  // 1. So sánh doanh thu tuần này với tuần trước (cùng số ngày đã trôi qua).
  const currentRevenue = currentOrders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + o.total_amount, 0);
  const previousRevenue = (previousOrdersRes.data ?? [])
    .filter((o) => o.payment_status === "paid")
    .reduce((s, o) => s + o.total_amount, 0);

  const change = computePercentChange(currentRevenue, previousRevenue);
  if (change.pct === null) {
    insights.push({
      id: "revenue-trend",
      text:
        currentRevenue > 0
          ? "Tuần trước chưa có doanh thu để so sánh — tuần này đã bắt đầu phát sinh doanh thu."
          : "Chưa có đủ dữ liệu doanh thu để so sánh tuần này với tuần trước.",
      tone: currentRevenue > 0 ? "up" : "neutral",
    });
  } else if (change.direction === "flat") {
    insights.push({
      id: "revenue-trend",
      text: "Doanh thu tuần này gần như không đổi so với tuần trước (tính đến thời điểm hiện tại).",
      tone: "neutral",
    });
  } else {
    const verb = change.direction === "up" ? "tăng" : "giảm";
    insights.push({
      id: "revenue-trend",
      text: `Doanh thu tuần này ${verb} ${Math.abs(change.pct)}% so với tuần trước (tính đến thời điểm hiện tại).`,
      tone: change.direction,
    });
  }

  // 2. Món bán chạy nhất tuần này — theo TỈ TRỌNG SỐ LƯỢT GỌI MÓN, KHÔNG phải
  //    tỉ trọng doanh thu: order_items không lưu đơn giá tại thời điểm đặt
  //    (xem ghi chú getBestSellers), nên 1 tỉ lệ % doanh thu tính từ giá HIỆN
  //    TẠI của món có thể sai lệch với doanh thu thực đã chốt ở orders.total_amount.
  //    Tỉ trọng số lượng phản ánh đúng thực tế mà không cần đánh đổi độ chính xác.
  type ItemRow = { menu_item_id: string; quantity: number; menu_item: { name: string } | null };
  const itemRows = (currentItemsRes.data ?? []) as unknown as ItemRow[];
  const totalQuantity = itemRows.reduce((s, r) => s + r.quantity, 0);
  if (itemRows.length > 0 && totalQuantity > 0) {
    const byItem = new Map<string, { name: string; quantity: number }>();
    for (const row of itemRows) {
      const existing = byItem.get(row.menu_item_id);
      const name = row.menu_item?.name ?? "Món đã xoá";
      if (existing) existing.quantity += row.quantity;
      else byItem.set(row.menu_item_id, { name, quantity: row.quantity });
    }
    // `.sort(...)[0]` gõ ra `T | undefined` vì `noUncheckedIndexedAccess` —
    // trên thực tế luôn có phần tử vì điều kiện `itemRows.length > 0` ở trên
    // đảm bảo `byItem` không rỗng, nhưng TypeScript không suy luận được qua
    // chuỗi Map -> Array.from -> sort, nên vẫn cần guard tường minh.
    const top = Array.from(byItem.values()).sort((a, b) => b.quantity - a.quantity)[0];
    if (top) {
      const share = Math.round((top.quantity / totalQuantity) * 1000) / 10;
      insights.push({
        id: "top-item",
        text: `Món bán chạy nhất tuần này là "${top.name}", chiếm ${share}% tổng số lượt gọi món.`,
        tone: "neutral",
      });
    }
  }

  // 3. Khung giờ cao điểm tuần này (cửa sổ 2 giờ liên tiếp nhiều lượt đặt nhất).
  const hourlyCounts = new Map<number, number>();
  for (const order of currentOrders) {
    const hour = new Date(order.created_at).getHours();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
  }
  const peak = findPeakTwoHourWindow(hourlyCounts);
  if (peak) {
    insights.push({
      id: "peak-hour",
      text: `Khung giờ cao điểm của quán tuần này là từ ${formatHour(peak.startHour)} đến ${formatHour(peak.endHour)}.`,
      tone: "neutral",
    });
  }

  if (insights.length === 0) {
    insights.push({ id: "no-data", text: "Chưa có đủ dữ liệu tuần này để đưa ra nhận định.", tone: "neutral" });
  }

  return insights;
}
