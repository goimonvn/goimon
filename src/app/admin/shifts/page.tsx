"use client";

import { ShiftDetailDialog } from "@/components/admin/ShiftDetailDialog";
import { ShiftsTable } from "@/components/admin/ShiftsTable";
import { StatCard } from "@/components/admin/StatCard";
import { useShiftHistory } from "@/hooks/useShiftHistory";
import { calculateCashDiscrepancy } from "@/lib/shifts";
import { formatCurrency } from "@/lib/utils";
import type { ShiftWithStaff } from "@/types";
import { AlertTriangle, Banknote, Clock } from "lucide-react";
import { useState } from "react";

/** Trang lịch sử ca làm việc toàn quán — theo dõi giờ vào/ra và đối chiếu chênh lệch tiền mặt của từng nhân viên. */
export default function AdminShiftsPage() {
  const { shifts, loading } = useShiftHistory();
  const [selected, setSelected] = useState<ShiftWithStaff | null>(null);

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

      <ShiftsTable shifts={shifts} loading={loading} onSelect={setSelected} />

      <ShiftDetailDialog shift={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
