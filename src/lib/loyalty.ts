import { POINTS_PER_VND } from "@/types";

/** Số điểm thưởng cho một đơn hàng — làm tròn xuống, ví dụ 45.000đ -> 4 điểm. */
export function calculatePointsEarned(totalAmount: number): number {
  return Math.floor(totalAmount / POINTS_PER_VND);
}
