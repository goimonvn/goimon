"use client";

import { cartStorageKey } from "@/lib/utils";
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
import { useTable } from "./TableContext";

interface AddToCartInput {
  menuItem: MenuItemsRow & { options: ItemOptionsRow[] };
  quantity: number;
  selectedOptions: ItemOptionsRow[];
  note: string;
}

interface CartContextValue {
  lines: CartLine[];
  totalCount: number;
  totalAmount: number;
  addLine: (input: AddToCartInput) => void;
  /**
   * Thêm 1 combo vào giỏ — "nổ" thành nhiều CartLine (1 dòng / món thành
   * phần), tất cả dùng chung 1 comboGroupId mới sinh. `quantity` là số GÓI
   * combo khách chọn (không phải số lượng từng món thành phần) — xem
   * ComboDetailSheet. Bấm "thêm combo" nhiều lần tạo nhiều group độc lập,
   * KHÔNG gộp vào group cũ (đơn giản hơn scale tỉ lệ 1 group đã có sẵn).
   */
  addComboLines: (combo: ComboWithItems, quantity: number) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  removeLine: (cartLineId: string) => void;
  /** Xoá TOÀN BỘ các dòng thuộc cùng 1 lần thêm combo (Module 11) — dùng ở "thẻ combo" trong giỏ hàng, không xoá lẻ từng thành phần. */
  removeComboGroup: (comboGroupId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function computeUnitPrice(basePrice: number, options: ItemOptionsRow[]): number {
  return basePrice + options.reduce((sum, o) => sum + o.additional_price, 0);
}

/**
 * Giỏ hàng lưu localStorage theo từng bàn (key gắn table.id) để:
 * - Khách lỡ refresh/khoá màn hình không mất giỏ hàng trước khi gửi đơn.
 * - Khách bàn khác quét QR trên cùng thiết bị demo không bị lẫn giỏ hàng.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { table } = useTable();
  const storageKey = table ? cartStorageKey(table.id) : null;
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!storageKey) {
      setLines([]);
      return;
    }
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
      if (!storageKey) return;
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

  /**
   * "Nổ" combo thành N CartLine (N = số món thành phần) dùng chung 1
   * comboGroupId mới. CHỈ dòng đầu tiên mang giá trọn gói combo.price (nhân
   * số gói) trong unitPrice/lineTotal — các dòng còn lại có giá 0 — để tổng
   * giỏ hàng luôn bằng đúng giá combo, xem ghi chú chi tiết ở types/index.ts#CartLine.
   * Số lượng mỗi dòng = quantity CỦA THÀNH PHẦN đó trong 1 gói (combo_items.quantity)
   * NHÂN số gói khách chọn — để KDS/trừ kho nhận đúng số lượng thực tế cần làm.
   */
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
          l.cartLineId === cartLineId
            ? { ...l, quantity, lineTotal: l.unitPrice * quantity }
            : l
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

  const value = useMemo<CartContextValue>(
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart phải được dùng bên trong CartProvider");
  return ctx;
}
