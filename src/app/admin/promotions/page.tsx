"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PromotionFormDialog } from "@/components/admin/PromotionFormDialog";
import { PromotionsTable } from "@/components/admin/PromotionsTable";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { usePromotions } from "@/hooks/usePromotions";
import { deletePromotion, setPromotionActive } from "@/services/promotion.service";
import type { PromotionsRow } from "@/types/database.types";
import { Percent, Ticket, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Quản lý khuyến mãi (Module 9): tạo/sửa mã giảm giá hoặc khuyến mãi Happy
 * Hour tự động, bật/tắt nhanh, theo dõi số lượt đã dùng — xem
 * services/promotion.service.ts và lib/promotions.ts cho logic tính giảm giá
 * dùng chung với giỏ hàng của khách (Module 1).
 */
export default function AdminPromotionsPage() {
  const { promotions, loading, refetch } = usePromotions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<PromotionsRow | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<PromotionsRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCount = promotions.filter((p) => p.is_active).length;
  const autoApplyCount = promotions.filter((p) => !p.requires_code).length;

  function handleAddNew() {
    setEditingPromotion(null);
    setFormOpen(true);
  }

  function handleEdit(promotion: PromotionsRow) {
    setEditingPromotion(promotion);
    setFormOpen(true);
  }

  async function handleToggleActive(promotion: PromotionsRow, isActive: boolean) {
    try {
      await setPromotionActive(promotion.id, isActive);
      toast.success(isActive ? "Đã bật khuyến mãi." : "Đã tắt khuyến mãi.");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái khuyến mãi.");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingPromotion) return;
    setDeleting(true);
    try {
      await deletePromotion(deletingPromotion.id);
      toast.success("Đã xoá khuyến mãi.");
      setDeletingPromotion(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá khuyến mãi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Khuyến mãi</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý mã giảm giá và khuyến mãi Happy Hour tự động áp dụng.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Ticket className="mr-1 h-4 w-4" />
          Thêm khuyến mãi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Tổng số khuyến mãi" value={`${promotions.length}`} icon={Percent} />
        <StatCard label="Đang bật" value={`${activeCount}`} icon={Ticket} />
        <StatCard label="Tự động (Happy Hour)" value={`${autoApplyCount}`} icon={Zap} />
      </div>

      <PromotionsTable
        promotions={promotions}
        loading={loading}
        onToggleActive={(promotion, isActive) => void handleToggleActive(promotion, isActive)}
        onEdit={handleEdit}
        onDelete={setDeletingPromotion}
      />

      <PromotionFormDialog
        open={formOpen}
        promotion={editingPromotion}
        onOpenChange={setFormOpen}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={deletingPromotion !== null}
        title="Xoá khuyến mãi?"
        description={`Khuyến mãi "${deletingPromotion?.description ?? ""}" sẽ bị xoá vĩnh viễn. Các đơn đã dùng mã này vẫn giữ nguyên số tiền đã giảm.`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeletingPromotion(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
