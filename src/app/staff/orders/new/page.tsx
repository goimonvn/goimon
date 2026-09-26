"use client";

import { CartFAB } from "@/components/customer/CartFAB";
import { ComboDetailSheet } from "@/components/customer/ComboDetailSheet";
import { ComboSection } from "@/components/customer/ComboSection";
import { ItemOptionsSheet } from "@/components/customer/ItemOptionsSheet";
import { CategoryTabs } from "@/components/customer/CategoryTabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { MenuSkeleton } from "@/components/shared/MenuSkeleton";
import { DeliveryCartProvider, useDeliveryCart } from "@/contexts/DeliveryCartContext";
import { useCombos } from "@/hooks/useCombos";
import { useDeliverySettings } from "@/hooks/useDeliverySettings";
import { useMenu } from "@/hooks/useMenu";
import { STAFF_DELIVERY_CART_STORAGE_KEY } from "@/lib/cart";
import type { ComboWithItems, MenuItemWithOptions } from "@/types";
import { Bike, ChevronLeft, Coffee } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

/**
 * `/staff/orders/new` — bước 1 (chọn món) của luồng "Tạo đơn giao hàng"
 * (Module 19 mở rộng) dành cho nhân viên khi khách gọi điện đặt mua qua điện
 * thoại. Dùng lại GẦN NHƯ Y HỆT `/delivery` (Module 19) — cùng
 * CategoryTabs/ItemOptionsSheet/ComboSection/ComboDetailSheet/CartFAB — vì
 * bản chất vẫn là "chọn món cho 1 đơn giao tận nơi", chỉ khác 2 điểm: (1)
 * giỏ hàng dùng khoá localStorage riêng (xem trên) và (2) bước 2 (giỏ hàng +
 * xác nhận) nằm ở `/staff/orders/new/cart` — một trang RIÊNG với luồng thanh
 * toán khác hẳn `/delivery/cart` (xem trang đó).
 */
function StaffNewDeliveryOrderPage() {
  const { categories, loading } = useMenu();
  const { combos } = useCombos();
  const { addLine, addComboLines, totalCount, totalAmount } = useDeliveryCart();
  const { settings: deliverySettings, loading: settingsLoading } = useDeliverySettings();
  const [selectedItem, setSelectedItem] = useState<MenuItemWithOptions | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<ComboWithItems | null>(null);

  function handleSelectItem(item: MenuItemWithOptions) {
    if (!item.is_available) {
      toast.error(`${item.name} hiện đã hết, quán sẽ sớm cập nhật lại.`);
      return;
    }
    setSelectedItem(item);
  }

  // Cùng công tắc "Kênh Giao tận nơi" ở /admin/settings (Module 17/19) áp
  // dụng nhất quán cho CẢ khách tự đặt lẫn nhân viên tạo hộ — nếu quán đang
  // tạm ngưng nhận đơn giao hàng, nhân viên cũng không nên tạo thêm đơn mới.
  if (!settingsLoading && deliverySettings && !deliverySettings.enable_delivery) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Bike className="h-10 w-10 text-muted-foreground" />}
          title="Kênh giao hàng đang tạm tắt"
          description='Bật lại "Kênh Giao tận nơi" ở Cấu hình thanh toán trước khi tạo đơn mới.'
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center gap-2">
        <Link href="/staff/orders" aria-label="Quay lại" className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Tạo đơn giao hàng</h1>
          <p className="text-xs text-muted-foreground">Chọn món hộ khách đang đặt qua điện thoại.</p>
        </div>
      </header>

      {loading ? (
        <MenuSkeleton />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Coffee className="h-10 w-10 text-muted-foreground" />}
          title="Quán chưa cập nhật thực đơn"
          description="Vui lòng thêm món ở /admin/menu trước."
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

      <CartFAB totalCount={totalCount} totalAmount={totalAmount} href="/staff/orders/new/cart" />
    </div>
  );
}

export default function StaffNewDeliveryOrderRoute() {
  return (
    <DeliveryCartProvider storageKey={STAFF_DELIVERY_CART_STORAGE_KEY}>
      <StaffNewDeliveryOrderPage />
    </DeliveryCartProvider>
  );
}
