import { calculateCashDiscrepancy, calculateExpectedHandover } from "@/lib/shifts";
import { cn, formatCurrency } from "@/lib/utils";

interface ShiftSummaryCardShift {
  initial_cash: number;
  total_revenue_cash: number;
  total_revenue_transfer: number;
  final_cash: number | null;
}

interface ShiftSummaryCardProps {
  shift: ShiftSummaryCardShift;
  /** Số đơn đã thu tiền trong ca — chỉ có ngay sau khi gọi RPC `close_shift` (không lưu cột riêng), ẩn dòng này nếu không truyền. */
  orderCount?: number;
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: "default" | "primary" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", emphasis === "primary" && "font-bold text-primary")}>{value}</dd>
    </div>
  );
}

/**
 * Bảng tóm tắt số liệu 1 ca làm việc — component thuần tuý hiển thị, dùng
 * chung cho bước "Báo cáo chốt ca" (nhân viên, `EndShiftDialog`) và chi tiết
 * ca ở `/admin/shifts` (`ShiftDetailDialog`), đảm bảo 2 nơi luôn khớp công thức
 * (xem `lib/shifts.ts`).
 */
export function ShiftSummaryCard({ shift, orderCount }: ShiftSummaryCardProps) {
  const expectedHandover = calculateExpectedHandover(shift);
  const discrepancy = calculateCashDiscrepancy(shift);

  return (
    <dl className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
      <Row label="Tiền đầu ca" value={formatCurrency(shift.initial_cash)} />
      <Row label="Tổng tiền mặt thu được" value={formatCurrency(shift.total_revenue_cash)} />
      <Row label="Tổng chuyển khoản (VietQR)" value={formatCurrency(shift.total_revenue_transfer)} />
      {orderCount !== undefined && <Row label="Số đơn đã phục vụ" value={`${orderCount}`} />}

      <div className="border-t pt-3">
        <Row label="Tiền mặt cần bàn giao" value={formatCurrency(expectedHandover)} emphasis="primary" />
      </div>

      {shift.final_cash !== null && (
        <>
          <Row label="Tiền mặt thực đếm" value={formatCurrency(shift.final_cash)} />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Chênh lệch</dt>
            <dd
              className={cn(
                "font-bold tabular-nums",
                discrepancy === 0 && "text-emerald-600",
                (discrepancy ?? 0) > 0 && "text-blue-600",
                (discrepancy ?? 0) < 0 && "text-destructive"
              )}
            >
              {discrepancy !== null && discrepancy > 0 ? "+" : ""}
              {formatCurrency(discrepancy ?? 0)}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
