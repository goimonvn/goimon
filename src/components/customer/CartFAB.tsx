"use client";

import { formatCurrency } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

interface CartFABProps {
  totalCount: number;
  totalAmount: number;
}

/** Nút giỏ hàng nổi ở đáy màn hình, chỉ hiện khi giỏ có ít nhất 1 món. */
export function CartFAB({ totalCount, totalAmount }: CartFABProps) {
  const router = useRouter();

  if (totalCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/order/cart")}
      className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg"
    >
      <span className="flex items-center gap-2 font-medium">
        <ShoppingCart className="h-5 w-5" />
        {totalCount} món
      </span>
      <span className="font-semibold">{formatCurrency(totalAmount)}</span>
    </button>
  );
}
