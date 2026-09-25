import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildQrImageUrl, createPaymentLink, generatePayosOrderCode } from "@/services/payos.service";
import type { CreatePaymentLinkRequest, CreatePaymentLinkResult } from "@/types";
import type { OrdersRow, TablesRow } from "@/types/database.types";

// Bắt buộc Node.js runtime — cần module "crypto" (payos.service) để ký/xác
// minh chữ ký PayOS, Edge runtime không có API này (giống /api/print/lan).
export const runtime = "nodejs";

function isValidBody(value: unknown): value is CreatePaymentLinkRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).orderId === "string" &&
    (value as Record<string, unknown>).orderId !== ""
  );
}

/**
 * Tạo link/mã VietQR động qua PayOS cho 1 bàn (Module 15) — khách gọi route
 * này KHÔNG cần đăng nhập (giống /api/notify/telegram, đúng mức RLS đã cho
 * phép khách ẩn danh thao tác trên `orders`), nên PHẢI tự dựng lại toàn bộ dữ
 * liệu nhạy cảm ở SERVER thay vì tin theo client:
 *   - Số tiền: KHÔNG nhận trực tiếp từ client — tự tính lại = tổng mọi đơn
 *     đang hoạt động, CHƯA thanh toán của đúng bàn chứa `orderId` gửi lên
 *     (tránh khách sửa số tiền gửi lên để trả thiếu).
 *   - `orderId` chỉ dùng để XÁC ĐỊNH BÀN — đơn giữ payment_order_code/
 *     payment_link_id sau khi tạo (đơn "neo") chính là đơn này, nhưng số
 *     tiền/nội dung QR đại diện cho CẢ BÀN (xem giải thích đầy đủ ở
 *     schema.sql Module 15).
 *
 * Dùng SERVICE ROLE (bỏ qua RLS) vì cần đọc + ghi trên `orders` mà không có
 * phiên đăng nhập nào — an toàn vì mọi input đều được validate lại từ đầu,
 * không có đường nào cho client tự ý đọc/ghi dữ liệu ngoài đúng luồng này.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Thiếu orderId." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Xem ghi chú ở daily-telegram/route.ts: `.select()` cột hẹp trên client
  // viết tay không suy luận chính xác kiểu, luôn ép kiểu tường minh qua
  // `unknown` ngay sau khi lấy `data` về thay vì dựa vào suy luận tự động.
  type AnchorOrderRow = Pick<OrdersRow, "id" | "table_id" | "order_type" | "payment_status">;
  const { data: anchorOrderData, error: anchorError } = await supabase
    .from("orders")
    .select("id, table_id, order_type, payment_status")
    .eq("id", body.orderId)
    .maybeSingle();
  const anchorOrder = anchorOrderData as unknown as AnchorOrderRow | null;

  if (anchorError || !anchorOrder) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }

  // Phạm vi Module 15: chỉ đơn tại bàn — xem giải thích ở schema.sql.
  if (anchorOrder.order_type !== "dine_in" || !anchorOrder.table_id) {
    return NextResponse.json(
      { error: "Thanh toán VietQR tự động hiện chỉ áp dụng cho đơn tại bàn." },
      { status: 400 }
    );
  }

  if (anchorOrder.payment_status === "paid") {
    return NextResponse.json({ error: "Đơn này đã được thanh toán." }, { status: 400 });
  }

  const { data: tableData, error: tableError } = await supabase
    .from("tables")
    .select("table_number")
    .eq("id", anchorOrder.table_id)
    .maybeSingle();
  const table = tableData as unknown as Pick<TablesRow, "table_number"> | null;

  if (tableError || !table) {
    return NextResponse.json({ error: "Không xác định được bàn." }, { status: 404 });
  }

  // Tổng tiền = TOÀN BỘ đơn đang hoạt động, chưa thanh toán của bàn — không
  // chỉ riêng đơn neo (xem JSDoc hàm này + schema.sql Module 15).
  const { data: activeOrdersData, error: activeOrdersError } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("table_id", anchorOrder.table_id)
    .eq("payment_status", "unpaid")
    .in("status", ["pending", "preparing"]);
  const activeOrders = activeOrdersData as unknown as Pick<OrdersRow, "total_amount">[] | null;

  if (activeOrdersError) {
    return NextResponse.json({ error: "Không thể tính tổng tiền của bàn." }, { status: 500 });
  }

  const amount = (activeOrders ?? []).reduce((sum, o) => sum + o.total_amount, 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "Bàn không có đơn nào cần thanh toán." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const orderCode = generatePayosOrderCode();

  try {
    const link = await createPaymentLink({
      orderCode,
      amount,
      tableNumber: table.table_number,
      cancelUrl: `${origin}/order/status`,
      returnUrl: `${origin}/order/status`,
    });

    // Ép kiểu `as any` ngay sau .from("orders") — cùng lý do đã ghi chú ở
    // /api/admin/staff/route.ts và /api/cron/reset-availability/route.ts:
    // TypeScript suy luận sai tham số của .update() trên client tạo bằng
    // createClient thuần (createSupabaseAdminClient), không ảnh hưởng runtime.
    const { error: updateError } = await (supabase.from("orders") as any)
      .update({ payment_order_code: orderCode, payment_link_id: link.paymentLinkId })
      .eq("id", anchorOrder.id);

    if (updateError) {
      return NextResponse.json({ error: "Không thể lưu lại link thanh toán." }, { status: 500 });
    }

    const result: CreatePaymentLinkResult = {
      orderCode,
      amount,
      qrImageUrl: buildQrImageUrl(link.qrCode),
      checkoutUrl: link.checkoutUrl,
    };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo link thanh toán PayOS." },
      { status: 502 }
    );
  }
}
