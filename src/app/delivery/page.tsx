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
import { usePageTitle } from "@/hooks/usePageTitle";
import type { ComboWithItems, MenuItemWithOptions } from "@/types";
import { Bike, Coffee } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * `/delivery` — trang Browse thực đơn cho kênh Giao tận nơi (Module 19),
 * CÔNG KHAI (không đăng nhập), KHÔNG gắn với bàn nào (khác `/order?table=`).
 * Tách riêng khỏi `/order` (dù dùng lại gần như y hệt các component
 * CategoryTabs/ItemOptionsSheet/CartFAB) vì `/order` bắt buộc phải nằm trong
 * `TableGate`/`TableProvider` — kênh này không có khái niệm bàn để chờ, xem
 * `DeliveryCartContext.tsx`. Từ Module 19 mở rộng, ĐÃ gồm "Combo Tiết Kiệm"
 * (Module 11) — dùng lại đúng `ComboSection`/`ComboDetailSheet`/`useCombos`
 * của `/order` (Module 1), khác biệt DUY NHẤT là gọi `addComboLines` của
 * `useDeliveryCart` thay vì `useCart`.
 */
function DeliveryMenuPage() {
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

  // Chỉ chặn khi ĐÃ chắc chắn tải xong cấu hình VÀ cấu hình đó nói tắt (coi
  // như bật trong lúc đang tải/nếu lỗi, cùng triết lý fail-open đã áp dụng
  // xuyên suốt dự án — xem DEFAULT_DELIVERY_CONFIG).
  if (!settingsLoading && deliverySettings && !deliverySettings.enable_delivery) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Bike className="h-10 w-10 text-muted-foreground" />}
          title="Quán tạm ngưng nhận đơn giao hàng"
          description="Vui lòng quay lại sau hoặc ghé quán trực tiếp."
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center gap-2">
        <Bike className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Đặt hàng giao tận nơi</h1>
          <p className="text-xs text-muted-foreground">Chọn món, quán sẽ giao tận địa chỉ của bạn.</p>
        </div>
      </header>

      {loading ? (
        <MenuSkeleton />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Coffee className="h-10 w-10 text-muted-foreground" />}
          title="Quán chưa cập nhật thực đơn"
          description="Vui lòng quay lại sau."
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

      <CartFAB totalCount={totalCount} totalAmount={totalAmount} href="/delivery/cart" />
    </div>
  );
}

export default function DeliveryPage() {
  usePageTitle("Đặt hàng giao tận nơi");
  return (
    <DeliveryCartProvider>
      <DeliveryMenuPage />
    </DeliveryCartProvider>
  );
}
