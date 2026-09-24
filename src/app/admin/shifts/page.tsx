"use client";

import { AdminCloseShiftDialog } from "@/components/admin/AdminCloseShiftDialog";
import { AdminEditShiftDialog } from "@/components/admin/AdminEditShiftDialog";
import { ShiftDetailDialog } from "@/components/admin/ShiftDetailDialog";
import { ShiftsTable } from "@/components/admin/ShiftsTable";
import { StatCard } from "@/components/admin/StatCard";
import { useShiftHistory } from "@/hooks/useShiftHistory";
import { calculateCashDiscrepancy } from "@/lib/shifts";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Banknote, Clock } from "lucide-react";
import { useState } from "react";

/** Trang lịch sử ca làm việc toàn quán — theo dõi giờ vào/ra và đối chiếu chênh lệch tiền mặt của từng nhân viên. */
export default function AdminShiftsPage() {
  const { shifts, loading, refetch } = useShiftHistory();
  // Module 14: lưu ID thay vì cả object — luôn tra lại từ `shifts` (mảng mới
  // nhất, tự cập nhật qua realtime + refetch tay) để 3 dialog không hiện dữ
  // liệu cũ ngay sau khi vừa đóng ca hộ/sửa số liệu, giống quy ước đã dùng ở
  // `/staff/tables` (TableCard/TableDetailSheet).
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [closeShiftId, setCloseShiftId] = useState<string | null>(null);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);

  const selected = shifts.find((s) => s.id === selectedShiftId) ?? null;
  const closeTarget = shifts.find((s) => s.id === closeShiftId) ?? null;
  const editTarget = shifts.find((s) => s.id === editShiftId) ?? null;

  const activeCount = shifts.filter((s) => s.status === "active").length;
  const totalCashCollected = shifts.reduce((sum, s) => sum + s.total_revenue_cash, 0);
  const discrepancyCount = shifts.filter((s) => {
    const d = calculateCashDiscrepancy(s);
    return d !== null && d !== 0;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Ca làm việc</h1>
        <p className="text-sm text-muted-foreground">
          Lịch sử chấm công và đối chiếu tiền mặt của toàn bộ nhân viên.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Đang mở ca" value={`${activeCount}`} icon={Clock} />
        <StatCard label="Tổng tiền mặt đã thu" value={formatCurrency(totalCashCollected)} icon={Banknote} />
        <StatCard label="Ca lệch quỹ" value={`${discrepancyCount}`} icon={AlertTriangle} />
      </div>

      <ShiftsTable shifts={shifts} loading={loading} onSelect={(s) => setSelectedShiftId(s.id)} />

      <ShiftDetailDialog
        shift={selected}
        onOpenChange={(open) => !open && setSelectedShiftId(null)}
        onOpenCloseShift={(s) => {
          setSelectedShiftId(null);
          setCloseShiftId(s.id);
        }}
        onOpenEditShift={(s) => {
          setSelectedShiftId(null);
          setEditShiftId(s.id);
        }}
      />

      <AdminCloseShiftDialog
        shift={closeTarget}
        onOpenChange={(open) => !open && setCloseShiftId(null)}
        onClosed={refetch}
      />

      <AdminEditShiftDialog
        shift={editTarget}
        onOpenChange={(open) => !open && setEditShiftId(null)}
        onSaved={refetch}
      />
    </div>
  );
}
