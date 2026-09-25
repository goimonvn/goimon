import { NextResponse } from "next/server";
import { STAFF_CALL_LABEL } from "@/types";
import type { StaffCallRequestType } from "@/types/database.types";

// Chỉ cần fetch() gọi ra ngoài (Telegram API) — chạy được cả Node lẫn Edge,
// nhưng khai báo "nodejs" tường minh để nhất quán với /api/print/lan (mọi
// Route Handler dùng secret phía server trong dự án đều cùng 1 runtime).
export const runtime = "nodejs";

const MAX_COMMENT_LENGTH = 300;
const MAX_ITEM_NAME_LENGTH = 80;
const MAX_ITEMS_IN_MESSAGE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Số bàn hợp lệ — chặn giá trị vô lý (âm, số thực, quá lớn) trước khi đưa vào tin nhắn. */
function isValidTableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1000;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isValidStaffCallRequestType(value: unknown): value is StaffCallRequestType {
  return value === "call_staff" || value === "need_ice" || value === "checkout";
}

/**
 * Dựng nội dung tin nhắn HOÀN TOÀN Ở SERVER theo từng `type` cố định — route
 * KHÔNG bao giờ nhận một trường "text" tự do từ client rồi gửi thẳng lên
 * Telegram. Lý do: route này KHÔNG yêu cầu đăng nhập (khách ẩn danh phải gọi
 * được để báo đơn mới/gọi nhân viên/gửi đánh giá — đúng những hành động
 * RLS vốn đã cho phép `anon` thực hiện trực tiếp trên Supabase), nên nếu cho
 * phép text tự do, một client bất kỳ có thể lợi dụng route để gửi tin nhắn
 * tuỳ ý qua bot Telegram của quán. Giới hạn ở vài mẫu tin cố định + validate
 * từng trường giữ route này an toàn tương đương mức RLS đã chấp nhận cho các
 * bảng orders/staff_calls/feedbacks.
 */
function buildMessageText(body: unknown): string | null {
  if (!isRecord(body) || typeof body.type !== "string") return null;

  switch (body.type) {
    case "new_order": {
      if (!isValidTableNumber(body.tableNumber) || !Array.isArray(body.items)) return null;

      const itemLines = body.items
        .slice(0, MAX_ITEMS_IN_MESSAGE)
        .map((item: unknown) => {
          if (!isRecord(item)) return null;
          const name = typeof item.name === "string" && item.name.trim() ? item.name : "Món";
          const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
          return `• ${quantity}x ${escapeHtml(name.slice(0, MAX_ITEM_NAME_LENGTH))}`;
        })
        .filter((line): line is string => line !== null)
        .join("\n");

      const totalAmount = typeof body.totalAmount === "number" && Number.isFinite(body.totalAmount)
        ? body.totalAmount
        : 0;

      return [
        `🔔 <b>Đơn hàng mới — Bàn ${body.tableNumber}</b>`,
        itemLines || "(không có món)",
        `Tổng cộng: ${totalAmount.toLocaleString("vi-VN")}đ`,
      ].join("\n");
    }

    case "new_takeaway_order": {
      if (typeof body.customerName !== "string" || !body.customerName.trim()) return null;
      if (typeof body.customerPhone !== "string" || !body.customerPhone.trim()) return null;
      if (!Array.isArray(body.items)) return null;

      const itemLines = body.items
        .slice(0, MAX_ITEMS_IN_MESSAGE)
        .map((item: unknown) => {
          if (!isRecord(item)) return null;
          const name = typeof item.name === "string" && item.name.trim() ? item.name : "Món";
          const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
          return `• ${quantity}x ${escapeHtml(name.slice(0, MAX_ITEM_NAME_LENGTH))}`;
        })
        .filter((line): line is string => line !== null)
        .join("\n");

      const totalAmount = typeof body.totalAmount === "number" && Number.isFinite(body.totalAmount)
        ? body.totalAmount
        : 0;

      const pickupLabel =
        typeof body.pickupTime === "string" && body.pickupTime
          ? new Date(body.pickupTime).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
          : "Sớm nhất có thể";

      return [
        `🛍️ <b>Đơn mang đi mới — ${escapeHtml(body.customerName.trim().slice(0, MAX_ITEM_NAME_LENGTH))}</b>`,
        `SĐT: ${escapeHtml(body.customerPhone.trim().slice(0, 20))}`,
        `Hẹn lấy lúc: ${pickupLabel}`,
        itemLines || "(không có món)",
        `Tổng cộng: ${totalAmount.toLocaleString("vi-VN")}đ`,
      ].join("\n");
    }

    case "staff_call": {
      if (!isValidTableNumber(body.tableNumber) || !isValidStaffCallRequestType(body.requestType)) return null;
      return `🙋 <b>Bàn ${body.tableNumber}</b>: ${escapeHtml(STAFF_CALL_LABEL[body.requestType])}`;
    }

    case "low_stock": {
      const ingredientName =
        typeof body.ingredientName === "string" && body.ingredientName.trim()
          ? escapeHtml(body.ingredientName.slice(0, MAX_ITEM_NAME_LENGTH))
          : null;
      const stockQuantity = typeof body.stockQuantity === "number" ? body.stockQuantity : null;
      const minThreshold = typeof body.minThreshold === "number" ? body.minThreshold : null;
      const unit = typeof body.unit === "string" ? escapeHtml(body.unit.slice(0, 20)) : "";
      if (ingredientName === null || stockQuantity === null || minThreshold === null) return null;

      return [
        `📉 <b>Sắp hết nguyên liệu: ${ingredientName}</b>`,
        `Tồn kho hiện tại: ${stockQuantity}${unit} (ngưỡng cảnh báo: ${minThreshold}${unit})`,
        "Vui lòng nhập thêm hàng.",
      ].join("\n");
    }

    case "new_reservation": {
      if (typeof body.customerName !== "string" || !body.customerName.trim()) return null;
      if (typeof body.customerPhone !== "string" || !body.customerPhone.trim()) return null;
      const partySize =
        typeof body.partySize === "number" && Number.isInteger(body.partySize) && body.partySize > 0
          ? body.partySize
          : null;
      if (partySize === null) return null;

      const reservationTimeLabel =
        typeof body.reservationTime === "string" && body.reservationTime
          ? new Date(body.reservationTime).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
          : "Chưa rõ giờ";

      const note =
        typeof body.note === "string" && body.note.trim()
          ? escapeHtml(body.note.trim().slice(0, MAX_COMMENT_LENGTH))
          : "";

      return [
        `🗓️ <b>Đặt bàn mới — cần gọi lại xác nhận</b>`,
        `${escapeHtml(body.customerName.trim().slice(0, MAX_ITEM_NAME_LENGTH))} · ${escapeHtml(body.customerPhone.trim().slice(0, 20))}`,
        `${partySize} khách · Lúc ${reservationTimeLabel}`,
        note ? `Ghi chú: ${note}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "new_feedback": {
      const tableLabel = isValidTableNumber(body.tableNumber) ? `Bàn ${body.tableNumber}` : "Khách";
      const ratingBeverage = typeof body.ratingBeverage === "number" ? body.ratingBeverage : 0;
      const ratingService = typeof body.ratingService === "number" ? body.ratingService : 0;
      const ratingSpace = typeof body.ratingSpace === "number" ? body.ratingSpace : 0;
      const comment =
        typeof body.comment === "string" && body.comment.trim()
          ? escapeHtml(body.comment.trim().slice(0, MAX_COMMENT_LENGTH))
          : "";

      return [
        `⭐ <b>Đánh giá mới — ${tableLabel}</b>`,
        `Đồ uống: ${ratingBeverage}/5 · Phục vụ: ${ratingService}/5 · Không gian: ${ratingSpace}/5`,
        comment ? `Nhận xét: ${comment}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    default:
      return null;
  }
}

/**
 * Relay gửi tin nhắn Telegram cho quán. KHÔNG yêu cầu đăng nhập (xem JSDoc
 * buildMessageText) — bù lại, nội dung tin nhắn luôn do SERVER tự dựng theo
 * mẫu cố định, không có đường nào để client tự viết text.
 *
 * Nếu quán CHƯA cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID trong biến môi
 * trường, trả về `{ skipped: true }` thay vì lỗi — đây là tính năng TUỲ CHỌN,
 * thiếu cấu hình không được phép làm gián đoạn luồng đặt món/gọi nhân
 * viên/gửi đánh giá ở phía client (client luôn gọi fire-and-forget, không
 * quan tâm response, nhưng route vẫn trả mã đúng ngữ nghĩa để dễ debug qua
 * log server khi cần).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ skipped: true });
  }

  const text = buildMessageText(body);
  if (!text) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
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
