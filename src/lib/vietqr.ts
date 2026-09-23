/**
 * Tiện ích tạo URL ảnh VietQR động theo số tiền + mã đơn.
 * Dùng chung cho cả màn hình thanh toán của khách (Module 1) và màn hình
 * xác nhận thanh toán của nhân viên (Module 2) — tránh lặp code cấu hình.
 */
const VIETQR_BANK_ID = process.env.NEXT_PUBLIC_VIETQR_BANK_ID;
const VIETQR_ACCOUNT_NO = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO;
const VIETQR_ACCOUNT_NAME = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NAME;

export function isVietQrConfigured(): boolean {
  return Boolean(VIETQR_BANK_ID && VIETQR_ACCOUNT_NO);
}

/** referenceLabel: đoạn text ngắn hiển thị trong nội dung chuyển khoản, ví dụ mã đơn/số bàn. */
export function buildVietQrUrl(amount: number, referenceLabel: string): string | null {
  if (!VIETQR_BANK_ID || !VIETQR_ACCOUNT_NO) return null;
  const description = encodeURIComponent(`GOIMON ${referenceLabel}`.trim());
  const accountName = encodeURIComponent(VIETQR_ACCOUNT_NAME ?? "");
  return `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?amount=${Math.round(
    amount
  )}&addInfo=${description}&accountName=${accountName}`;
}
