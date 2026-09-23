"use client";

import { ComboFormDialog } from "@/components/admin/ComboFormDialog";
import { CombosTable } from "@/components/admin/CombosTable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { useAdminCombos } from "@/hooks/useAdminCombos";
import { deleteCombo, setComboActive } from "@/services/combo.service";
import type { ComboWithItems } from "@/types";
import { Gift, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Quản lý Combo & Set món ưu đãi (Module 11): tạo/sửa combo, chọn món thành
 * phần từ menu hiện có, gán giá bán đặc biệt, bật/tắt hiển thị ngay lập tức
 * (realtime) — xem services/combo.service.ts cho luồng "nổ" combo thành
 * order_items dùng chung với giỏ hàng của khách (Module 1) và KDS (Module 2).
 */
export default function AdminCombosPage() {
  const { combos, loading, refetch } = useAdminCombos();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboWithItems | null>(null);
  const [deletingCombo, setDeletingCombo] = useState<ComboWithItems | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCount = combos.filter((c) => c.is_active).length;

  function handleAddNew() {
    setEditingCombo(null);
    setFormOpen(true);
  }

  function handleEdit(combo: ComboWithItems) {
    setEditingCombo(combo);
    setFormOpen(true);
  }

  async function handleToggleActive(combo: ComboWithItems, isActive: boolean) {
    try {
      await setComboActive(combo.id, isActive);
      toast.success(isActive ? "Đã bật hiển thị combo." : "Đã ẩn combo.");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái combo.");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCombo) return;
    setDeleting(true);
    try {
      await deleteCombo(deletingCombo.id);
      toast.success("Đã xoá combo.");
      setDeletingCombo(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá combo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Combo & Set món ưu đãi</h1>
          <p className="text-sm text-muted-foreground">
            Gộp nhiều món thành 1 gói giá ưu đãi, hiển thị ở mục &quot;Combo Tiết Kiệm&quot; trên thực đơn của khách.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Gift className="mr-1 h-4 w-4" />
          Thêm combo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Tổng số combo" value={`${combos.length}`} icon={Gift} />
        <StatCard label="Đang hiển thị" value={`${activeCount}`} icon={PackageCheck} />
      </div>

      <CombosTable
        combos={combos}
        loading={loading}
        onToggleActive={(combo, isActive) => void handleToggleActive(combo, isActive)}
        onEdit={handleEdit}
        onDelete={setDeletingCombo}
      />

      <ComboFormDialog open={formOpen} combo={editingCombo} onOpenChange={setFormOpen} onSaved={refetch} />

      <ConfirmDialog
        open={deletingCombo !== null}
        title="Xoá combo?"
        description={`Combo "${deletingCombo?.name ?? ""}" sẽ bị xoá vĩnh viễn. Các đơn đã bán combo này vẫn giữ nguyên lịch sử.`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeletingCombo(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
