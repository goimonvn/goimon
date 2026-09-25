import crypto from "crypto";
import { AppError, type PayOSWebhookData } from "@/types";

/**
 * Tích hợp PayOS (Module 15) — gọi thẳng REST API bằng `fetch` (KHÔNG dùng
 * SDK `@payos/node`) để tránh phải thêm 1 dependency mới vào package.json.
 * Lý do quan trọng: dự án đã khoá CỨNG (không dấu `^`) toàn bộ phiên bản thư
 * viện sau sự cố build ở Module Deploy đầu tiên (xem huong-dan-deploy.md
 * Phần 6 mục 5) — thêm 1 thư viện mới mà không build thật được để xác nhận
 * đúng phiên bản tương thích là rủi ro không cần thiết, trong khi REST API +
 * thuật toán ký (HMAC-SHA256) của PayOS đã được công bố công khai, ổn định
 * từ ngày đầu ra mắt và không cần SDK để dùng đúng.
 *
 * 3 biến môi trường bắt buộc — CHỈ đọc ở server (route Handler chạy Node.js),
 * KHÔNG có tiền tố NEXT_PUBLIC_ (xem .env.local.example):
 *   PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY
 */

const PAYOS_API_BASE = "https://api-merchant.payos.vn";
/** PayOS giới hạn `description` tối đa 25 ký tự. */
const MAX_DESCRIPTION_LENGTH = 25;

export function isPayosConfigured(): boolean {
  return Boolean(
    process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY
  );
}

/** Sinh orderCode duy nhất gửi PayOS — mốc thời gian (ms) + 2 số ngẫu nhiên, đủ để không trùng kể cả 2 yêu cầu tới cùng 1ms, vẫn nằm an toàn trong Number.MAX_SAFE_INTEGER và bigint của Postgres. */
export function generatePayosOrderCode(): number {
  const randomSuffix = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return Number(`${Date.now()}${randomSuffix}`);
}

/**
 * `label` phân biệt "đơn của ai" trong nội dung chuyển khoản (khách/ngân hàng
 * nhìn thấy) — `B{tableNumber}` cho đơn tại bàn (Module 15), `DH{8 ký tự đầu
 * orderId}` cho đơn giao hàng (Module 19, không có số bàn để dùng). Đổi tên
 * tham số từ `tableNumber` (Module 15) sang `label` (Module 19) để hàm này
 * dùng chung được cho cả 2 luồng — xem 2 nơi gọi ở
 * `/api/payments/payos/create-link/route.ts`.
 */
function buildDescription(label: string): string {
  const text = `Thanh toan GOIMON ${label}`;
  return text.slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Chuyển 1 object thành query-string đã SẮP XẾP KEY THEO ALPHABET (bắt buộc
 * để chữ ký khớp với PayOS) — thuật toán này giữ ĐÚNG như SDK chính thức của
 * PayOS công bố (hàm `convertObjToQueryStr`): null/undefined -> chuỗi rỗng,
 * mảng -> JSON.stringify. Dùng chung cho cả lúc TẠO chữ ký (tạo link) lẫn lúc
 * XÁC MINH chữ ký (webhook) — 2 chiều phải cùng 1 thuật toán mới đối chiếu
 * đúng.
 */
function convertObjectToSignatureQueryString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      if (value === null || value === undefined) {
        value = "";
      }
      return `${key}=${value}`;
    })
    .join("&");
}

function sign(data: Record<string, unknown>, checksumKey: string): string {
  const queryStr = convertObjectToSignatureQueryString(data);
  return crypto.createHmac("sha256", checksumKey).update(queryStr).digest("hex");
}

export interface CreatePayosLinkParams {
  orderCode: number;
  amount: number;
  /** Xem JSDoc `buildDescription` — `"B{tableNumber}"` cho đơn tại bàn, `"DH{...}"` cho đơn giao hàng. */
  label: string;
  /** URL PayOS chuyển khách trình duyệt tới nếu khách bấm huỷ ở trang checkout hosted của PayOS — luồng chính của app KHÔNG dùng trang này (hiện QR ngay trong CheckoutSheet) nhưng PayOS bắt buộc phải có giá trị. */
  cancelUrl: string;
  returnUrl: string;
}

export interface CreatePayosLinkResult {
  checkoutUrl: string;
  /** Chuỗi nội dung QR thô (chuẩn VietQR/EMVCo) — KHÔNG phải URL ảnh, phải tự dựng ảnh QR từ chuỗi này (xem buildQrImageUrl). */
  qrCode: string;
  paymentLinkId: string;
}

/** Tạo 1 link thanh toán VietQR động qua PayOS cho đúng số tiền + mã đơn duy nhất. */
export async function createPaymentLink(params: CreatePayosLinkParams): Promise<CreatePayosLinkResult> {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError("Quán chưa cấu hình PayOS (thiếu biến môi trường PAYOS_*).");
  }

  const amount = Math.round(params.amount);
  const description = buildDescription(params.label);

  // Chữ ký chỉ ký đúng 5 trường này (thứ tự alphabet: amount, cancelUrl,
  // description, orderCode, returnUrl) — theo đúng quy định chữ ký của PayOS
  // cho API tạo link thanh toán, KHÔNG ký toàn bộ body gửi đi.
  const signature = sign(
    {
      amount,
      cancelUrl: params.cancelUrl,
      description,
      orderCode: params.orderCode,
      returnUrl: params.returnUrl,
    },
    checksumKey
  );

  const response = await fetch(`${PAYOS_API_BASE}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      orderCode: params.orderCode,
      amount,
      description,
      cancelUrl: params.cancelUrl,
      returnUrl: params.returnUrl,
      signature,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    code?: string;
    desc?: string;
    data?: { checkoutUrl?: string; qrCode?: string; paymentLinkId?: string };
  } | null;

  if (!response.ok || !body || body.code !== "00" || !body.data) {
    throw new AppError(
      `Không thể tạo link thanh toán PayOS${body?.desc ? `: ${body.desc}` : "."}`,
      body
    );
  }

  const { checkoutUrl, qrCode, paymentLinkId } = body.data;
  if (!checkoutUrl || !qrCode || !paymentLinkId) {
    throw new AppError("PayOS trả về thiếu dữ liệu link thanh toán.", body);
  }

  return { checkoutUrl, qrCode, paymentLinkId };
}

/** Dựng ảnh QR (PNG) từ chuỗi nội dung QR thô PayOS trả về — dùng dịch vụ ảnh QR công khai api.qrserver.com, ĐÃ dùng trong dự án cho mã QR bàn (xem huong-dan-deploy.md), không cần thêm thư viện/API key mới. */
export function buildQrImageUrl(qrCodeContent: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrCodeContent)}`;
}

/**
 * Xác minh chữ ký webhook PayOS gửi lên — CHỐNG GIẢ MẠO: bất kỳ ai cũng có
 * thể POST thẳng tới `/api/webhooks/payos` với body tự bịa `code: "00"` để
 * cố tình đánh dấu 1 đơn là "đã thanh toán" mà không hề chuyển tiền, nếu
 * route không kiểm tra chữ ký này. Chữ ký ký trên toàn bộ object `data`
 * (không phải cả body) bằng CHÍNH `PAYOS_CHECKSUM_KEY` — chỉ PayOS (nắm giữ
 * key này) mới tính ra đúng chữ ký khớp.
 */
export function verifyWebhookSignature(
  data: PayOSWebhookData,
  signature: string
): boolean {
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!checksumKey) return false;

  const expected = sign(data as unknown as Record<string, unknown>, checksumKey);
  // So sánh độ dài cố định (timing-safe) — tránh lộ thông tin qua thời gian so sánh chuỗi.
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
