"use client";

import type { CartLine } from "@/types";
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
  updateQuantity: (cartLineId: string, quantity: number) => void;
  removeLine: (cartLineId: string) => void;
  clearCart: () => void;
}

const DeliveryCartContext = createContext<DeliveryCartContextValue | undefined>(undefined);

/** Key CỐ ĐỊNH (không theo bàn nào) — khác `cartStorageKey(tableId)` của CartContext (Module 1), vì kênh giao hàng (Module 19) không gắn với bàn nào để làm khoá phân biệt. */
const DELIVERY_CART_STORAGE_KEY = "goimon_delivery_cart";

function computeUnitPrice(basePrice: number, options: ItemOptionsRow[]): number {
  return basePrice + options.reduce((sum, o) => sum + o.additional_price, 0);
}

/**
 * Giỏ hàng cho kênh Giao tận nơi (Module 19) — KHÔNG dùng lại `CartProvider`
 * (Module 1) vì giỏ đó bắt buộc phải có `useTable()` (ném lỗi nếu dùng ngoài
 * `TableProvider`) và khoá localStorage của nó gắn theo `table.id` — kênh
 * `/delivery` không có khái niệm bàn nào cả. Cố ý KHÔNG hỗ trợ combo ở lần
 * triển khai này (ngoài phạm vi yêu cầu ban đầu, xem `addComboLines` của
 * `CartContext` để mở rộng sau nếu cần) — giữ giỏ hàng đơn giản: mỗi dòng là 1
 * món lẻ kèm topping/ghi chú, giống hệt cấu trúc `CartLine` nhưng luôn
 * `comboId/comboGroupId/comboName` = undefined.
 */
export function DeliveryCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DELIVERY_CART_STORAGE_KEY);
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : []);
    } catch {
      setLines([]);
    }
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(DELIVERY_CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Bỏ qua lỗi lưu trữ cục bộ — giỏ hàng vẫn hoạt động trong phiên hiện tại.
    }
  }, []);

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
    () => ({ lines, totalCount, totalAmount, addLine, updateQuantity, removeLine, clearCart }),
    [lines, totalCount, totalAmount, addLine, updateQuantity, removeLine, clearCart]
  );

  return <DeliveryCartContext.Provider value={value}>{children}</DeliveryCartContext.Provider>;
}

export function useDeliveryCart(): DeliveryCartContextValue {
  const ctx = useContext(DeliveryCartContext);
  if (!ctx) throw new Error("useDeliveryCart phải được dùng bên trong DeliveryCartProvider");
  return ctx;
}
