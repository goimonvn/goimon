"use client";

import type { CartLine, ComboWithItems } from "@/types";
import type { ItemOptionsRow, MenuItemsRow } from "@/types/database.types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface AddToCartInput {
  menuItem: MenuItemsRow & { options: ItemOptionsRow[] };
  quantity: number;
  selectedOptions: ItemOptionsRow[];
  note: string;
}

interface DeliveryCartContextValue {
  lines: CartLine[];
  totalCount: number;
  totalAmount: number;
  addLine: (input: AddToCartInput) => void;
  /** Thêm 1 combo vào giỏ — "nổ" thành nhiều CartLine, xem CartContext.addComboLines (Module 11) cho giải thích đầy đủ. Thêm ở đây từ Module 19 mở rộng (trước đó `/delivery` cố ý chưa hỗ trợ combo). */
  addComboLines: (combo: ComboWithItems, quantity: number) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  removeLine: (cartLineId: string) => void;
  /** Xoá toàn bộ các dòng thuộc cùng 1 lần thêm combo — xem CartContext.removeComboGroup. */
  removeComboGroup: (comboGroupId: string) => void;
  clearCart: () => void;
}

const DeliveryCartContext = createContext<DeliveryCartContextValue | undefined>(undefined);

/** Key MẶC ĐỊNH (không theo bàn nào) — khác `cartStorageKey(tableId)` của CartContext (Module 1), vì kênh giao hàng (Module 19) không gắn với bàn nào để làm khoá phân biệt. */
const DELIVERY_CART_STORAGE_KEY = "goimon_delivery_cart";

function computeUnitPrice(basePrice: number, options: ItemOptionsRow[]): number {
  return basePrice + options.reduce((sum, o) => sum + o.additional_price, 0);
}

interface DeliveryCartProviderProps {
  children: ReactNode;
  /**
   * Cho phép ghi đè khoá localStorage (Module 19 mở rộng) — dùng để tách
   * RIÊNG giỏ hàng của `/staff/orders/new` (nhân viên tạo đơn hộ khách gọi
   * điện) khỏi giỏ hàng của khách tự đặt ở `/delivery`, tránh 2 luồng vô tình
   * dùng CHUNG 1 giỏ nếu cùng mở trên 1 trình duyệt (vd nhân viên thử nghiệm
   * cả 2 trang). Mặc định dùng đúng khoá cũ nếu không truyền — hành vi của
   * `/delivery`/`/delivery/cart` không đổi.
   */
  storageKey?: string;
}

/**
 * Giỏ hàng cho kênh Giao tận nơi (Module 19) — KHÔNG dùng lại `CartProvider`
 * (Module 1) vì giỏ đó bắt buộc phải có `useTable()` (ném lỗi nếu dùng ngoài
 * `TableProvider`) và khoá localStorage của nó gắn theo `table.id` — kênh
 * `/delivery` không có khái niệm bàn nào cả. Từ Module 19 mở rộng, ĐÃ hỗ trợ
 * combo (trước đó cố ý chưa làm ở lần triển khai đầu — xem `addComboLines`),
 * theo ĐÚNG khuôn mẫu "nổ combo thành nhiều CartLine" của `CartContext`
 * (Module 11): `createDeliveryOrder`/`createStaffDeliveryOrder`
 * (`delivery.service.ts`) đã insert sẵn `combo_id`/`combo_group_id`/
 * `combo_name` vào `order_items` từ trước, không cần đổi schema hay service.
 */
export function DeliveryCartProvider({ children, storageKey = DELIVERY_CART_STORAGE_KEY }: DeliveryCartProviderProps) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : []);
    } catch {
      setLines([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Bỏ qua lỗi lưu trữ cục bộ — giỏ hàng vẫn hoạt động trong phiên hiện tại.
      }
    },
    [storageKey]
  );

  const addLine = useCallback(
    (input: AddToCartInput) => {
      const unitPrice = computeUnitPrice(input.menuItem.price, input.selectedOptions);
      const newLine: CartLine = {
        cartLineId: crypto.randomUUID(),
        menuItem: input.menuItem,
        quantity: input.quantity,
        selectedOptions: input.selectedOptions,
        note: input.note,
        unitPrice,
        lineTotal: unitPrice * input.quantity,
        stationType: input.menuItem.station_type,
      };
      persist([...lines, newLine]);
    },
    [lines, persist]
  );

  const addComboLines = useCallback(
    (combo: ComboWithItems, quantity: number) => {
      if (combo.items.length === 0) return;
      const comboGroupId = crypto.randomUUID();
      const newLines: CartLine[] = combo.items.map((comboItem, index) => {
        const lineQuantity = comboItem.quantity * quantity;
        const isPriceCarrier = index === 0;
        const unitPrice = isPriceCarrier ? combo.price : 0;
        return {
          cartLineId: crypto.randomUUID(),
          menuItem: { ...comboItem.menuItem, options: [] },
          quantity: lineQuantity,
          selectedOptions: [],
          note: "",
          unitPrice,
          lineTotal: isPriceCarrier ? combo.price * quantity : 0,
          stationType: comboItem.menuItem.station_type,
          comboId: combo.id,
          comboGroupId,
          comboName: combo.name,
        };
      });
      persist([...lines, ...newLines]);
    },
    [lines, persist]
  );

  const removeComboGroup = useCallback(
    (comboGroupId: string) => persist(lines.filter((l) => l.comboGroupId !== comboGroupId)),
    [lines, persist]
  );

  const updateQuantity = useCallback(
    (cartLineId: string, quantity: number) => {
      if (quantity <= 0) {
        persist(lines.filter((l) => l.cartLineId !== cartLineId));
        return;
      }
      persist(
        lines.map((l) =>
          l.cartLineId === cartLineId ? { ...l, quantity, lineTotal: l.unitPrice * quantity } : l
        )
      );
    },
    [lines, persist]
  );

  const removeLine = useCallback(
    (cartLineId: string) => persist(lines.filter((l) => l.cartLineId !== cartLineId)),
    [lines, persist]
  );

  const clearCart = useCallback(() => persist([]), [persist]);

  const totalCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines]);

  const value = useMemo<DeliveryCartContextValue>(
    () => ({
      lines,
      totalCount,
      totalAmount,
      addLine,
      addComboLines,
      updateQuantity,
      removeLine,
      removeComboGroup,
      clearCart,
    }),
    [lines, totalCount, totalAmount, addLine, addComboLines, updateQuantity, removeLine, removeComboGroup, clearCart]
  );

  return <DeliveryCartContext.Provider value={value}>{children}</DeliveryCartContext.Provider>;
}

export function useDeliveryCart(): DeliveryCartContextValue {
  const ctx = useContext(DeliveryCartContext);
  if (!ctx) throw new Error("useDeliveryCart phải được dùng bên trong DeliveryCartProvider");
  return ctx;
}
