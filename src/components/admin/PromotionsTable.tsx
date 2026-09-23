"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDiscountLabel } from "@/lib/promotions";
import { formatCurrency } from "@/lib/utils";
import type { PromotionsRow } from "@/types/database.types";
import { Pencil, Trash2 } from "lucide-react";

interface PromotionsTableProps {
  promotions: PromotionsRow[];
  loading: boolean;
  onToggleActive: (promotion: PromotionsRow, isActive: boolean) => void;
  onEdit: (promotion: PromotionsRow) => void;
  onDelete: (promotion: PromotionsRow) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/** Bảng danh sách khuyến mãi — bao gồm cả mã đã tắt/hết hạn (chỉ admin xem được đầy đủ, xem RLS trong schema.sql). */
export function PromotionsTable({ promotions, loading, onToggleActive, onEdit, onDelete }: PromotionsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có khuyến mãi nào. Bấm &quot;Thêm khuyến mãi&quot; để bắt đầu.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Mã / Mô tả</th>
            <th className="px-4 py-3 text-right font-medium">Mức giảm</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Đơn tối thiểu</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Hiệu lực</th>
            <th className="px-4 py-3 text-right font-medium">Đã dùng</th>
            <th className="px-4 py-3 font-medium">Bật</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map((promotion) => (
            <tr key={promotion.id} className="border-t">
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 font-medium">
                  {promotion.code ?? <span className="italic text-muted-foreground">Tự động (Giờ Vàng)</span>}
                  {promotion.daily_start_time && (
                    <Badge variant="warning" className="shrink-0">
                      {promotion.daily_start_time.slice(0, 5)}–{promotion.daily_end_time?.slice(0, 5)}
                    </Badge>
                  )}
                </div>
                <div className="max-w-xs truncate text-xs text-muted-foreground">{promotion.description}</div>
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-primary">
                {formatDiscountLabel(promotion)}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                {promotion.min_order_value > 0 ? formatCurrency(promotion.min_order_value) : "—"}
              </td>
              <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                {formatDateTime(promotion.start_time)} → {formatDateTime(promotion.end_time)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {promotion.times_used}
                {promotion.usage_limit !== null ? ` / ${promotion.usage_limit}` : ""}
              </td>
              <td className="px-4 py-3">
                <Switch
                  checked={promotion.is_active}
                  onCheckedChange={(checked) => onToggleActive(promotion, checked)}
                  aria-label={promotion.is_active ? "Đang bật" : "Đang tắt"}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(promotion)} aria-label="Sửa">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(promotion)}
                    aria-label="Xoá"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
