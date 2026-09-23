import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp className theo chuẩn shadcn (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Định dạng số tiền VND, ví dụ 45000 -> "45.000đ". */
export function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
      amount
    ) + "đ"
  );
}

export const TABLE_STORAGE_KEY = "goimon_table";
export const cartStorageKey = (tableId: string): string =>
  `goimon_cart_${tableId}`;
/** Khách hàng thân thiết đã tra cứu/đăng ký lưu THEO BÀN — giống giỏ hàng, để phiên khách mới ngồi vào bàn không bị lẫn danh tính khách trước. */
export const customerStorageKey = (tableId: string): string =>
  `goimon_customer_${tableId}`;

/**
 * Thuế suất VAT dùng để TÍNH TẠM tiền thuế hiển thị ở trang "Hoá đơn VAT".
 * Schema `vat_invoices` (theo đúng yêu cầu gốc) không lưu thuế suất/số tiền
 * thuế riêng — chỉ lưu thông tin công ty để xuất hoá đơn ngoài hệ thống kế
 * toán. Vì vậy số tiền VAT ở đây là ước tính giả định `total_amount` đã bao
 * gồm thuế, KHÔNG phải số liệu đã chốt trên hoá đơn thực. Đổi giá trị này
 * nếu quán áp dụng thuế suất khác.
 */
export const VAT_RATE = 0.08;

/** Tách phần thuế VAT ước tính ra khỏi tổng tiền đã bao gồm thuế (total_amount). */
export function estimateVatAmount(totalAmountInclVat: number): number {
  return Math.round((totalAmountInclVat * VAT_RATE) / (1 + VAT_RATE));
}
