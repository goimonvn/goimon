"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PurchaseReceiptFormDialog } from "@/components/admin/PurchaseReceiptFormDialog";
import { PurchaseReceiptsTable } from "@/components/admin/PurchaseReceiptsTable";
import { StatCard } from "@/components/admin/StatCard";
import { SupplierFormDialog } from "@/components/admin/SupplierFormDialog";
import { SuppliersTable } from "@/components/admin/SuppliersTable";
import { Button } from "@/components/ui/button";
import { usePurchaseReceipts } from "@/hooks/usePurchaseReceipts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { shopDateString } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { deleteSupplier } from "@/services/purchasing.service";
import type { SuppliersRow } from "@/types/database.types";
import { Package, Plus, Truck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Quản lý nhà cung cấp & nhập hàng (Module 20) — mở rộng Module 6 (kho): ghi
 * phiếu nhập hàng theo nhà cung cấp + giá nhập từng dòng, để tính giá
 * vốn/biên lợi nhuận theo từng món (xem bảng ở cuối `/admin/inventory`) thay
 * vì chỉ "lợi nhuận gộp hôm nay" theo ngày (Module 12).
 */
export default function AdminPurchasesPage() {
  const { suppliers, loading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers();
  const { receipts, loading: receiptsLoading, refetch: refetchReceipts } = usePurchaseReceipts();

  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SuppliersRow | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<SuppliersRow | null>(null);
  const [deletingSupplierBusy, setDeletingSupplierBusy] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);

  const monthPrefix = shopDateString().slice(0, 7); // "yyyy-MM"
  const { receiptsThisMonth, totalThisMonth } = useMemo(() => {
    const thisMonth = receipts.filter((r) => r.receipt_date.startsWith(monthPrefix));
    return {
      receiptsThisMonth: thisMonth.length,
      totalThisMonth: thisMonth.reduce((sum, r) => sum + r.total_amount, 0),
    };
  }, [receipts, monthPrefix]);

  function handleAddSupplier() {
    setEditingSupplier(null);
    setSupplierFormOpen(true);
  }

  function handleEditSupplier(supplier: SuppliersRow) {
    setEditingSupplier(supplier);
    setSupplierFormOpen(true);
  }

  async function handleConfirmDeleteSupplier() {
    if (!deletingSupplier) return;
    setDeletingSupplierBusy(true);
    try {
      await deleteSupplier(deletingSupplier.id);
      toast.success("Đã xoá nhà cung cấp.");
      setDeletingSupplier(null);
      refetchSuppliers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá nhà cung cấp.");
    } finally {
      setDeletingSupplierBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Nhập hàng</h1>
          <p className="text-sm text-muted-foreground">
            Nhà cung cấp và phiếu nhập hàng — mỗi phiếu tự cộng kho và cập nhật giá vốn bình quân từng nguyên liệu.
          </p>
        </div>
        <Button onClick={() => setReceiptFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Ghi phiếu nhập hàng
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Số nhà cung cấp" value={`${suppliers.length}`} icon={Users} />
        <StatCard label="Phiếu nhập tháng này" value={`${receiptsThisMonth}`} icon={Package} />
        <StatCard label="Tổng tiền nhập tháng này" value={formatCurrency(totalThisMonth)} icon={Truck} />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Lịch sử phiếu nhập hàng</h2>
        <PurchaseReceiptsTable receipts={receipts} loading={receiptsLoading} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Nhà cung cấp</h2>
          <Button variant="outline" size="sm" onClick={handleAddSupplier}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm nhà cung cấp
          </Button>
        </div>
        <SuppliersTable
          suppliers={suppliers}
          loading={suppliersLoading}
          onEdit={handleEditSupplier}
          onDelete={setDeletingSupplier}
        />
      </div>

      <PurchaseReceiptFormDialog open={receiptFormOpen} onOpenChange={setReceiptFormOpen} onSaved={refetchReceipts} />

      <SupplierFormDialog
        open={supplierFormOpen}
        supplier={editingSupplier}
        onOpenChange={setSupplierFormOpen}
        onSaved={refetchSuppliers}
      />

      <ConfirmDialog
        open={deletingSupplier !== null}
        title="Xoá nhà cung cấp?"
        description={`Nhà cung cấp "${deletingSupplier?.name ?? ""}" sẽ bị xoá. Thao tác này sẽ báo lỗi nếu nhà cung cấp đã có phiếu nhập hàng.`}
        submitting={deletingSupplierBusy}
        onOpenChange={(open) => !open && setDeletingSupplier(null)}
        onConfirm={() => void handleConfirmDeleteSupplier()}
      />
    </div>
  );
}
