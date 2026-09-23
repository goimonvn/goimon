import { CartProvider } from "@/contexts/CartContext";
import { CustomerProvider } from "@/contexts/CustomerContext";
import { TableProvider } from "@/contexts/TableContext";
import type { ReactNode } from "react";
import { Suspense } from "react";

/**
 * Layout dùng chung cho toàn bộ nhánh Module 1 (Khách hàng).
 * `useSearchParams` (trong TableProvider) bắt buộc phải nằm trong Suspense
 * theo yêu cầu của Next.js App Router khi render tĩnh.
 *
 * CustomerProvider (Module 5 — khách hàng thân thiết) nằm TRONG TableProvider
 * vì cần biết bàn hiện tại để lưu danh tính khách theo đúng bàn (xem JSDoc
 * trong CustomerContext.tsx).
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TableProvider>
        <CustomerProvider>
          <CartProvider>
            <div className="mx-auto min-h-dvh w-full max-w-md bg-background">{children}</div>
          </CartProvider>
        </CustomerProvider>
      </TableProvider>
    </Suspense>
  );
}
