"use client";

import { MenuAvailabilityRow } from "@/components/staff/MenuAvailabilityRow";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu } from "@/hooks/useMenu";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Bảng "Hết món nhanh": tái sử dụng nguyên useMenu() của Module 1 (đã có sẵn
 * realtime is_available) — nhân viên bật/tắt ở đây, khách hàng đang xem menu
 * thấy thay đổi ngay lập tức, không cần thêm hạ tầng realtime mới.
 */
export default function MenuControlPage() {
  usePageTitle("Hết món nhanh");
  const { categories, loading } = useMenu();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Hết món nhanh</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Tắt món khi hết nguyên liệu — khách hàng sẽ thấy ngay lập tức trên thực đơn.
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.id}>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">{category.name}</p>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <MenuAvailabilityRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
