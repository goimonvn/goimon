import type { CartLine } from "@/types";

/**
 * Khoá localStorage RIÊNG cho giỏ hàng nhân viên tạo hộ ở `/staff/orders/new`
 * (Module 19 mở rộng) — đặt CHUNG 1 chỗ (thay vì khai lặp ở cả 2 trang
 * `/staff/orders/new` và `/staff/orders/new/cart`) để không lệch nhau, vì 2
 * trang đó dùng 2 lần gọi `DeliveryCartProvider`/`useDeliveryCart` riêng biệt
 * nhưng PHẢI trỏ đúng cùng 1 khoá mới đọc lại được cùng giỏ hàng khi chuyển
 * trang (xem ghi chú `storageKey` ở `DeliveryCartContext.tsx`).
 */
export const STAFF_DELIVERY_CART_STORAGE_KEY = "goimon_staff_delivery_cart";

export type GroupedCartEntry =
  | { kind: "single"; line: CartLine }
  | { kind: "combo"; groupId: string; groupLines: CartLine[] };

/**
 * Gộp danh sách CartLine thành 1 mảng "hiển thị" — mỗi phần tử là 1 dòng lẻ
 * HOẶC 1 nhóm combo (giữ nguyên thứ tự xuất hiện lần đầu). Trả thẳng
 * `groupId` (thay vì để nơi gọi tự lấy `groupLines[0].comboGroupId`) — dùng
 * làm React key mà không cần index vào mảng (tsconfig bật
 * `noUncheckedIndexedAccess`, index mảng luôn trả `T | undefined`, dù
 * `groupLines` ở đây chắc chắn không rỗng vì luôn chứa ít nhất chính dòng
 * đang xét trong vòng lặp).
 *
 * Tách ra file riêng (Module 19 mở rộng — trước đó định nghĩa CỤC BỘ trong
 * `/order/cart/page.tsx`, Module 11) vì nay có tới 3 trang hiển thị giỏ hàng
 * hỗ trợ combo cần dùng chung logic gộp nhóm y hệt nhau: `/order/cart`
 * (Module 1/11), `/delivery/cart` (Module 19 mở rộng — nay đã hỗ trợ combo
 * giống `/order`), và `/staff/orders/new/cart` (Module 19 mở rộng — nhân
 * viên tạo đơn giao hàng hộ khách gọi điện).
 */
export function groupCartLines(lines: CartLine[]): GroupedCartEntry[] {
  const result: GroupedCartEntry[] = [];
  const seenGroups = new Set<string>();

  for (const line of lines) {
    if (!line.comboGroupId) {
      result.push({ kind: "single", line });
      continue;
    }
    if (seenGroups.has(line.comboGroupId)) continue;
    seenGroups.add(line.comboGroupId);
    result.push({
      kind: "combo",
      groupId: line.comboGroupId,
      groupLines: lines.filter((l) => l.comboGroupId === line.comboGroupId),
    });
  }

  return result;
}
