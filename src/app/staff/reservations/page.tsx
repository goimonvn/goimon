"use client";

import { ReservationFormDialog } from "@/components/staff/ReservationFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useReservations } from "@/hooks/useReservations";
import {
  assignReservationTable,
  cancelReservation,
  confirmReservation,
  markReservationNoShow,
  markReservationSeated,
} from "@/services/reservation.service";
import { getAllTables, subscribeToTableChanges } from "@/services/table.service";
import { RESERVATION_STATUS_LABEL, type ReservationWithTable } from "@/types";
import type { TablesRow } from "@/types/database.types";
import { CalendarClock, Phone, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const NO_TABLE = "none" as const;

type CancelTarget = { id: string; label: string; asRejection: boolean } | null;

/**
 * Đặt bàn trước từ xa (Module 18) — danh sách lượt đặt CHƯA kết thúc, chia 2
 * nhóm theo đúng luồng đã thống nhất (quán xác nhận THỦ CÔNG bằng cách gọi lại
 * cho khách): "Chờ xác nhận" (khách tự đặt qua `/dat-ban`, chưa được gọi lại)
 * và "Đã xác nhận" (đã gọi lại xác nhận, hoặc nhân viên tạo hộ ngay khi khách
 * gọi điện tới quán — xem nút "Tạo đặt bàn"). Gán bàn ở đây chỉ để hiện badge
 * tham khảo trên sơ đồ bàn (`/staff/tables`, xem TableCard.tsx) — KHÔNG đổi
 * trạng thái bàn, bàn vẫn tự chuyển "Đang có khách" đúng lúc khách gửi đơn gọi
 * món đầu tiên như luồng vãng lai bình thường.
 */
export default function StaffReservationsPage() {
  const { reservations, loading } = useReservations();
  const [tables, setTables] = useState<TablesRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTables() {
      try {
        const rows = await getAllTables();
        if (!cancelled) setTables(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách bàn.");
      }
    }

    void loadTables();
    const channel = subscribeToTableChanges(() => void loadTables());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  const pending = reservations.filter((r) => r.status === "pending");
  const confirmed = reservations.filter((r) => r.status === "confirmed");

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  }

  async function handleConfirm(reservation: ReservationWithTable) {
    setBusyId(reservation.id);
    try {
      await confirmReservation(reservation.id);
      toast.success(`Đã xác nhận đặt bàn cho ${reservation.customer_name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xác nhận đặt bàn.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSeated(reservation: ReservationWithTable) {
    setBusyId(reservation.id);
    try {
      await markReservationSeated(reservation.id);
      toast.success(`Đã đóng hồ sơ đặt bàn — mời ${reservation.customer_name} ra bàn.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật đặt bàn.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoShow(reservation: ReservationWithTable) {
    setBusyId(reservation.id);
    try {
      await markReservationNoShow(reservation.id);
      toast.success(`Đã đánh dấu ${reservation.customer_name} không tới.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật đặt bàn.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignTable(reservation: ReservationWithTable, tableId: string) {
    setBusyId(reservation.id);
    try {
      await assignReservationTable(reservation.id, tableId === NO_TABLE ? null : tableId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gán bàn.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelReservation(cancelTarget.id, cancelReason.trim() || null);
      toast.success(cancelTarget.asRejection ? "Đã từ chối yêu cầu đặt bàn." : "Đã huỷ đặt bàn.");
      setCancelTarget(null);
      setCancelReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể huỷ đặt bàn.");
    } finally {
      setCancelling(false);
    }
  }

  function renderReservationCard(reservation: ReservationWithTable) {
    const isPending = reservation.status === "pending";
    const busy = busyId === reservation.id;

    return (
      <div key={reservation.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{reservation.customer_name}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {reservation.customer_phone}
            </p>
          </div>
          <Badge variant={isPending ? "warning" : "success"}>
            {RESERVATION_STATUS_LABEL[reservation.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatTime(reservation.reservation_time)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {reservation.party_size} khách
          </span>
          {reservation.table_number !== null && (
            <span className="font-medium text-foreground">Bàn {reservation.table_number}</span>
          )}
        </div>

        {reservation.note && (
          <p className="rounded-lg bg-muted/60 p-2 text-xs italic text-muted-foreground">
            {reservation.note}
          </p>
        )}

        {isPending ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void handleConfirm(reservation)}>
              Xác nhận
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                setCancelTarget({ id: reservation.id, label: reservation.customer_name, asRejection: true })
              }
            >
              Từ chối
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Select
              value={reservation.table_id ?? NO_TABLE}
              disabled={busy}
              onValueChange={(v) => void handleAssignTable(reservation, v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Gán bàn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TABLE}>Chưa gán bàn</SelectItem>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    Bàn {table.table_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void handleSeated(reservation)}>
                Khách đã tới
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleNoShow(reservation)}>
                Không tới
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setCancelTarget({ id: reservation.id, label: reservation.customer_name, asRejection: false })
                }
              >
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Đặt bàn trước</h1>
          <p className="text-sm text-muted-foreground">
            Khách tự đặt qua link công khai, hoặc gọi điện tới quán để nhân viên tạo hộ.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo đặt bàn
        </Button>
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold">Chờ xác nhận ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Không có yêu cầu nào đang chờ gọi lại xác nhận.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map(renderReservationCard)}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold">Đã xác nhận ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Chưa có lượt đặt bàn nào được xác nhận.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {confirmed.map(renderReservationCard)}
          </div>
        )}
      </div>

      <ReservationFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={() => setFormOpen(false)} />

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelTarget?.asRejection ? "Từ chối" : "Huỷ"} đặt bàn của {cancelTarget?.label}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Lý do (không bắt buộc) — ví dụ: quán đã kín chỗ giờ đó."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={cancelling}
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
            >
              Đóng
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={() => void handleConfirmCancel()}>
              {cancelling ? "Đang xử lý..." : cancelTarget?.asRejection ? "Từ chối" : "Huỷ đặt bàn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
