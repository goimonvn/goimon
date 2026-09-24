import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shopDateString, shopDayBounds } from "@/lib/analytics";
import { EXPENSE_CATEGORY_LABEL } from "@/types";
import type { ExpenseCategory, PaymentMethod } from "@/types/database.types";

// Xem ghi chú runtime ở /api/cron/reset-availability/route.ts — cùng lý do.
export const runtime = "nodejs";

const TOP_ITEMS_LIMIT = 3;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

interface OrderAggRow {
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: PaymentMethod | null;
}

interface OrderItemAggRow {
  menu_item_id: string;
  quantity: number;
  menu_item: { name: string } | null;
}

/**
 * Dựng + gửi báo cáo cuối ngày về Telegram Group của quán (Module 12).
 *
 * CHỈ DÙNG SERVICE ROLE (createSupabaseAdminClient), KHÔNG dùng client thường
 * qua cookie phiên đăng nhập — route này được Vercel Cron gọi, không có nhân
 * viên nào "đang đăng nhập" tại thời điểm chạy. `orders` vốn cho phép SELECT
 * công khai (RLS `using(true)`, xem schema.sql) nhưng `expenses` CHỈ admin đọc
 * được — nếu dùng client thường (anon) sẽ luôn trả về rỗng cho phần chi phí,
 * làm sai số Lợi nhuận gộp trong báo cáo mà không có lỗi rõ ràng nào để phát
 * hiện. Service role tránh hẳn vấn đề này.
 *
 * "Hôm nay" tính theo giờ quán (Asia/Ho_Chi_Minh, xem lib/analytics.ts#shopDayBounds)
 * — KHÔNG dùng giờ hệ thống UTC mặc định của server Vercel.
 */
async function buildDailyReportMessage(): Promise<string> {
  const now = new Date();
  const { from, to } = shopDayBounds(now);
  const dateStr = shopDateString(now);

  const supabase = createSupabaseAdminClient();

  const [ordersRes, itemsRes, expensesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("total_amount, status, payment_status, payment_method")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    supabase
      .from("order_items")
      .select("menu_item_id, quantity, menu_item:menu_items(name)")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    supabase.from("expenses").select("amount, category").eq("expense_date", dateStr),
  ]);

  if (ordersRes.error || itemsRes.error || expensesRes.error) {
    throw new Error(
      ordersRes.error?.message ?? itemsRes.error?.message ?? expensesRes.error?.message ?? "unknown_error"
    );
  }

  const orders = (ordersRes.data ?? []) as unknown as OrderAggRow[];
  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const revenueTotal = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;

  const cashCount = paidOrders.filter((o) => o.payment_method === "cash").length;
  const transferCount = paidOrders.filter((o) => o.payment_method === "transfer").length;
  const paymentCountedTotal = cashCount + transferCount;
  const cashPct = paymentCountedTotal > 0 ? Math.round((cashCount / paymentCountedTotal) * 100) : 0;
  const transferPct = paymentCountedTotal > 0 ? 100 - cashPct : 0;

  const itemRows = (itemsRes.data ?? []) as unknown as OrderItemAggRow[];
  const byItem = new Map<string, { name: string; quantity: number }>();
  for (const row of itemRows) {
    const existing = byItem.get(row.menu_item_id);
    const name = row.menu_item?.name ?? "Món đã xoá";
    if (existing) existing.quantity += row.quantity;
    else byItem.set(row.menu_item_id, { name, quantity: row.quantity });
  }
  const topItems = Array.from(byItem.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, TOP_ITEMS_LIMIT);

  const expenseRows = (expensesRes.data ?? []) as unknown as { amount: number; category: ExpenseCategory }[];
  const totalExpenses = expenseRows.reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = revenueTotal - totalExpenses;

  const expenseByCategory = new Map<ExpenseCategory, number>();
  for (const row of expenseRows) {
    expenseByCategory.set(row.category, (expenseByCategory.get(row.category) ?? 0) + row.amount);
  }

  const lines = [
    `📊 <b>Báo cáo cuối ngày ${dateStr}</b>`,
    "",
    `💰 Doanh thu: ${formatVnd(revenueTotal)}`,
    `🧾 Chi phí: ${formatVnd(totalExpenses)}`,
    `📈 Lợi nhuận gộp: ${formatVnd(grossProfit)}`,
    `✅ Đơn hoàn thành: ${completedCount}`,
  ];

  if (paymentCountedTotal > 0) {
    lines.push(`💵 Tiền mặt / 🏦 Chuyển khoản: ${cashPct}% / ${transferPct}%`);
  }

  if (topItems.length > 0) {
    lines.push("", "🏆 <b>Top món bán chạy</b>");
    topItems.forEach((item, i) => {
      lines.push(`${i + 1}. ${escapeHtml(item.name)} — ${item.quantity} lượt`);
    });
  }

  if (expenseByCategory.size > 0) {
    lines.push("", "📋 <b>Chi phí theo loại</b>");
    for (const [category, amount] of expenseByCategory.entries()) {
      lines.push(`• ${EXPENSE_CATEGORY_LABEL[category]}: ${formatVnd(amount)}`);
    }
  }

  return lines.join("\n");
}

async function handleReport(): Promise<NextResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    // Giống /api/notify/telegram — TUỲ CHỌN, thiếu cấu hình không phải lỗi.
    return NextResponse.json({ skipped: true });
  }

  let text: string;
  try {
    text = await buildDailyReportMessage();
  } catch (error) {
    return NextResponse.json(
      { error: "database_error", message: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!telegramResponse.ok) {
      return NextResponse.json({ error: "telegram_api_error" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "network_error" }, { status: 502 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handleReport();
}

// Cho phép gọi thủ công bằng POST (vd để test bằng curl) — cùng logic, cùng yêu cầu xác thực.
export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}
