"use client";

import { ComboCard } from "@/components/customer/ComboCard";
import type { ComboWithItems } from "@/types";

interface ComboSectionProps {
  combos: ComboWithItems[];
  onSelectCombo: (combo: ComboWithItems) => void;
}

/** Mục "Combo Tiết Kiệm" hiển thị phía trên thực đơn theo danh mục — chỉ render khi có ít nhất 1 combo đang hiển thị (Module 11). */
export function ComboSection({ combos, onSelectCombo }: ComboSectionProps) {
  if (combos.length === 0) return null;

  return (
    <div className="mb-5">
      <h2 className="mb-3 text-base font-bold">🎁 Combo Tiết Kiệm</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {combos.map((combo) => (
          <ComboCard key={combo.id} combo={combo} onSelect={onSelectCombo} />
        ))}
      </div>
    </div>
  );
}
