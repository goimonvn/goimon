import { NextResponse } from "next/server";
import { calculatePointsEarned } from "@/lib/loyalty";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/services/payos.service";
import type { ConfirmPayosPaymentResultRow, OrdersRow } from "@/types/database.types";
import type { PayOSWebhookBody } from "@/types";

// Cần "crypto" (payos.service) + gọi Telegram API — Node.js runtime, giống mọi
// Route Handler khác trong dự án có xử lý secret/xác thực phía server.
export const runtime = "nodejs";

function isPayosWebhookBody(value: unknown): value is PayOSWebhookBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === "string" && typeof body.signature === "string";
}

/**
 * Gửi Telegram trực tiếp (server-to-server) — KHÔNG qua /api/notify/telegram vì
 * route đó chỉ nhận request từ CLIENT (trình duyệt), ở đây webhook PayOS gọi
 * thẳng server, không có "trình duyệt" nào để tự fetch route nội bộ.
 *
 * BẮT BUỘC PHẢI `await` (khác với mọi thông báo Telegram khác trong dự án,
 * vốn "bắn rồi quên" `void fetch(...)` vì được gọi TỪ TRÌNH DUYỆT của khách —
 * trình duyệt vẫn đang mở nên request luôn có đủ thời gian chạy xong). Ở ĐÂY
 * hàm này chạy trong 1 serverless function (Route Handler xử lý webhook) —
 * Vercel có thể đóng băng/kết thúc function ngay sau khi trả response, cắt
 * ngang bất kỳ `fetch` nào chưa kịp await xong. Vì vậy PHẢI await xong việc
 * gửi Telegram TRƯỚC KHI trả response ở POST bên dưới, nếu không tin nhắn có
 * thể gửi được có lúc không tuỳ Vercel đóng function nhanh hay chậm — đã gặp
 * đúng lỗi này khi test thật (thanh toán xác nhận đúng nhưng Telegram không
 * tới, dù 2 biến TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID đã cấu hình đúng, xác
 * nhận qua các thông báo Telegram khác vẫn hoạt động bình thường).
 *
 * Vẫn không bao giờ NÉM lỗi ra ngoài (bọc try/catch) — 1 request Telegram
 * lỗi/timeout không được phép làm webhook trả về khác 2xx, vì PayOS sẽ hiểu
 * nhầm là lỗi xử lý thanh toán rồi gọi lại liên tục.
 */
async function notifyPayosPaymentSuccessTelegram(
  tableNumber: number,
  settledAmount: number,
  orderCount: number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    `✅ <b>ĐÃ NHẬN TIỀN CHUYỂN KHOẢN</b>`,
    `Bàn ${tableNumber} — ${orderCount} đơn — Số tiền: ${Math.round(settledAmount).toLocaleString("vi-VN")}đ qua VietQR`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    // Bỏ qua lặng lẽ — xem giải thích ở JSDoc hàm này.
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Báo quán có đơn GIAO TẬN NƠI vừa thanh toán PayOS thành công (Module 19) —
 * NHÁNH RIÊNG của webhook, khác `notifyPayosPaymentSuccessTelegram` (đơn tại
 * bàn): dùng mẫu tin "🛵 ĐƠN SHIP MỚI" giống hệt đơn COD (xem
 * `/api/notify/telegram/route.ts` case `new_delivery_order`) để chủ quán nhận
 * đúng 1 dạng tin nhắn cho MỌI đơn giao hàng bất kể phương thức thanh toán,
 * KHÔNG kèm danh sách món (webhook không có sẵn order_items ở đây, chỉ có
 * order — giữ đơn giản, giống `notifyPayosPaymentSuccessTelegram` cũng không
 * liệt kê món). CÙNG LÝ DO BẮT BUỘC PHẢI AWAIT như hàm trên — xem JSDoc.
 */
async function notifyNewDeliveryOrderPaidTelegram(
  recipientName: string,
  recipientPhone: string,
  deliveryAddress: string,
  itemsTotal: number,
  shippingFee: number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    `🛵 <b>ĐƠN SHIP MỚI (đã thanh toán qua VietQR)</b>`,
    `Khách: ${escapeHtml(recipientName)} (${escapeHtml(recipientPhone)})`,
    `Đ/C: ${escapeHtml(deliveryAddress)}`,
    `Tổng: ${Math.round(itemsTotal).toLocaleString("vi-VN")}đ + Ship: ${Math.round(shippingFee).toLocaleString("vi-VN")}đ`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    // Bỏ qua lặng lẽ — xem giải thích ở JSDoc notifyPayosPaymentSuccessTelegram.
  }
}

/**
 * Webhook PayOS gọi khi trạng thái 1 link thanh toán thay đổi (Module 15).
 * KHÔNG yêu cầu đăng nhập (PayOS gọi thẳng từ server của họ, không có phiên
 * nào) — an toàn nhờ XÁC MINH CHỮ KÝ (verifyWebhookSignature) trên mọi
 * request trước khi tin bất kỳ điều gì trong `data`, chặn đứng khả năng ai đó
 * giả mạo request để tự đánh dấu 1 đơn "đã thanh toán".
 *
 * LUÔN trả về 2xx trừ khi chữ ký sai — kể cả khi không tìm thấy đơn/đã xử lý
 * trước đó — để PayOS không hiểu nhầm là lỗi rồi thử gọi lại liên tục/tắt
 * webhook. Xem thêm ghi chú "AN TOÀN GỌI LẶP" ở RPC confirm_payos_payment.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isPayosWebhookBody(body)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // PayOS gọi thử URL webhook lúc quán bấm "Xác nhận" trong dashboard của họ,
  // kèm `data: null` — không có gì để xử lý, trả 200 ngay để xác nhận URL
  // sống, KHÔNG coi là lỗi.
  if (!body.data) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!verifyWebhookSignature(body.data, body.signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const orderCode = body.data.orderCode;

  // code !== "00" — PayOS báo giao dịch không thành công (huỷ/lỗi...). CHỈ
  // đánh dấu riêng đơn neo là 'failed', KHÔNG đụng tới các đơn khác của bàn —
  // khách vẫn có thể thử lại hoặc trả tiền mặt bình thường.
  if (body.data.code !== "00") {
    // Ép kiểu `as any` ngay sau .from("orders") — cùng lý do đã ghi chú ở
    // /api/admin/staff/route.ts và /api/cron/reset-availability/route.ts:
    // TypeScript suy luận sai tham số của .update() trên client tạo bằng
    // createClient thuần (createSupabaseAdminClient), không ảnh hưởng runtime.
    await (supabase.from("orders") as any)
      .update({ payment_status: "failed" })
      .eq("payment_order_code", orderCode)
      .eq("payment_status", "unpaid");
    return NextResponse.json({ ok: true, failed: true });
  }

  const { data: settledRows, error: rpcError } = await supabase.rpc("confirm_payos_payment", {
    p_order_code: orderCode,
  });

  if (rpcError) {
    // Lỗi RPC thật (không phải "không tìm thấy") — trả 500 để PayOS thử lại
    // sau, vì đây có thể là sự cố tạm thời phía database.
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }

  const rows = (settledRows ?? []) as ConfirmPayosPaymentResultRow[];
  if (rows.length === 0) {
    // Không tìm thấy đơn neo, hoặc webhook gọi lặp cho giao dịch đã xử lý
    // trước đó — cả 2 trường hợp đều AN TOÀN để bỏ qua (xem ghi chú RPC).
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const tableId = rows[0]?.table_id ?? null;
  const settledAmount = rows.reduce((sum, r) => sum + r.total_amount, 0);

  // Cộng điểm thưởng cho từng đơn có customer_id — best-effort, lỗi không
  // được chặn việc webhook trả về thành công (tiền đã ghi nhận là quan trọng
  // nhất, giống hệt order.service.markOrdersPaid).
  await Promise.all(
    rows
      .filter((row): row is ConfirmPayosPaymentResultRow & { customer_id: string } => row.customer_id !== null)
      .map(async (row) => {
        try {
          await supabase.rpc("award_loyalty_points", {
            p_customer_id: row.customer_id,
            p_order_id: row.order_id,
            p_points: calculatePointsEarned(row.total_amount),
            p_amount: row.total_amount,
          });
        } catch {
          // Bỏ qua — xem giải thích ở JSDoc hàm này.
        }
      })
  );

  // NHÁNH ĐƠN TẠI BÀN (Module 15, không đổi): `table_id` khác null — bàn
  // chuyển "Cần dọn dẹp" (giống markOrdersPaid thủ công, Module 13) rồi báo
  // Telegram theo bàn.
  if (tableId) {
    await (supabase.from("tables") as any).update({ status: "needs_cleaning" }).eq("id", tableId);

    const tableNumber = rows[0]?.table_number ?? 0;
    // await ở đây — xem giải thích chi tiết trong JSDoc của hàm, đây LÀ điểm
    // khác biệt bắt buộc so với các thông báo Telegram "bắn rồi quên" khác.
    await notifyPayosPaymentSuccessTelegram(tableNumber, settledAmount, rows.length);

    return NextResponse.json({ ok: true, tableNumber, settledOrderCount: rows.length, settledAmount });
  }

  // NHÁNH ĐƠN GIAO HÀNG (Module 19, MỚI): `table_id` là null — RPC chỉ chốt
  // ĐÚNG 1 đơn (không gộp), tra thêm người nhận/địa chỉ/phí ship (RPC không
  // trả các cột này) rồi báo Telegram kiểu "ĐƠN SHIP MỚI". CỐ Ý KHÔNG đụng
  // `tables` (không có bàn) — xem giải thích "TÁCH delivery_status" ở
  // schema.sql Module 19: thanh toán xong KHÔNG đồng nghĩa đơn đã hoàn tất.
  const orderId = rows[0]?.order_id;
  if (orderId) {
    const { data: deliveryOrderData } = await supabase
      .from("orders")
      .select("recipient_name, recipient_phone, delivery_address, total_amount, shipping_fee")
      .eq("id", orderId)
      .maybeSingle();
    const deliveryOrder = deliveryOrderData as unknown as Pick<
      OrdersRow,
      "recipient_name" | "recipient_phone" | "delivery_address" | "total_amount" | "shipping_fee"
    > | null;

    if (deliveryOrder) {
      await notifyNewDeliveryOrderPaidTelegram(
        deliveryOrder.recipient_name ?? "Khách hàng",
        deliveryOrder.recipient_phone ?? "",
        deliveryOrder.delivery_address ?? "",
        deliveryOrder.total_amount,
        deliveryOrder.shipping_fee
      );
    }
  }

  return NextResponse.json({ ok: true, delivery: true, settledOrderCount: rows.length, settledAmount });
}
