"use client";

import { CartFAB } from "@/components/customer/CartFAB";
import { ComboDetailSheet } from "@/components/customer/ComboDetailSheet";
import { ComboSection } from "@/components/customer/ComboSection";
import { ItemOptionsSheet } from "@/components/customer/ItemOptionsSheet";
import { CategoryTabs } from "@/components/customer/CategoryTabs";
import { LoyaltyWidget } from "@/components/customer/LoyaltyWidget";
import { TableGate } from "@/components/customer/TableGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { MenuSkeleton } from "@/components/shared/MenuSkeleton";
import { useCart } from "@/contexts/CartContext";
import { useTable } from "@/contexts/TableContext";
import { useCombos } from "@/hooks/useCombos";
import { useMenu } from "@/hooks/useMenu";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { ComboWithItems, MenuItemWithOptions } from "@/types";
import { Coffee, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

function OrderPageContent() {
  const { table } = useTable();
  const { categories, loading } = useMenu();
  const { combos } = useCombos();
  const { addLine, addComboLines, totalCount, totalAmount } = useCart();
  const [selectedItem, setSelectedItem] = useState<MenuItemWithOptions | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<ComboWithItems | null>(null);

  function handleSelectItem(item: MenuItemWithOptions) {
    if (!item.is_available) {
      toast.error(`${item.name} hiện đã hết, quán sẽ sớm cập nhật lại.`);
      return;
    }
    setSelectedItem(item);
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bàn số</p>
          <h1 className="text-2xl font-bold">{table?.table_number}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LoyaltyWidget />
          <Link
            href="/order/status"
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
          >
            <ClipboardList className="h-4 w-4" />
            Đơn của tôi
          </Link>
        </div>
      </header>

      {loading ? (
        <MenuSkeleton />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Coffee className="h-10 w-10 text-muted-foreground" />}
          title="Quán chưa cập nhật thực đơn"
          description="Vui lòng gọi nhân viên để được hỗ trợ gọi món."
        />
      ) : (
        <>
          <ComboSection combos={combos} onSelectCombo={setSelectedCombo} />
          <CategoryTabs categories={categories} onSelectItem={handleSelectItem} />
        </>
      )}

      <ItemOptionsSheet
        item={selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        onConfirm={({ quantity, selectedOptions, note }) => {
          if (!selectedItem) return;
          addLine({ menuItem: selectedItem, quantity, selectedOptions, note });
          toast.success(`Đã thêm ${selectedItem.name} vào giỏ.`);
        }}
      />

      <ComboDetailSheet
        combo={selectedCombo}
        onOpenChange={(open) => !open && setSelectedCombo(null)}
        onConfirm={(quantity) => {
          if (!selectedCombo) return;
          addComboLines(selectedCombo, quantity);
          toast.success(`Đã thêm combo ${selectedCombo.name} vào giỏ.`);
        }}
      />

      <CartFAB totalCount={totalCount} totalAmount={totalAmount} />
    </div>
  );
}

export default function OrderPage() {
  usePageTitle("Đặt món");
  return (
    <TableGate>
      <OrderPageContent />
    </TableGate>
  );
}
