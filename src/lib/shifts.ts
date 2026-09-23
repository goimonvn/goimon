/**
 * Hàm thuần (pure) tính toán liên quan tới ca làm việc (Module 8) — dùng
 * chung giữa bảng "Báo cáo chốt ca" ở màn nhân viên và trang lịch sử ca ở
 * Admin, để đảm bảo hai nơi luôn hiển thị cùng một công thức.
 */

interface ExpectedHandoverInput {
  initial_cash: number;
  total_revenue_cash: number;
}

/**
 * Số tiền mặt LẼ RA phải có trong ca = tiền đầu ca + tổng tiền mặt thu được.
 * Không tính tiền chuyển khoản (VietQR) vì tiền đó không nằm trong ngăn kéo.
 */
export function calculateExpectedHandover(shift: ExpectedHandoverInput): number {
  return shift.initial_cash + shift.total_revenue_cash;
}

interface CashDiscrepancyInput extends ExpectedHandoverInput {
  final_cash: number | null;
}

/**
 * Chênh lệch = tiền mặt thực đếm - tiền mặt lẽ ra phải có.
 * - Dương: dư tiền. Âm: thiếu tiền. 0: khớp.
 * - `null` khi ca chưa đóng (chưa có `final_cash`).
 */
export function calculateCashDiscrepancy(shift: CashDiscrepancyInput): number | null {
  if (shift.final_cash === null) return null;
  return shift.final_cash - calculateExpectedHandover(shift);
}
