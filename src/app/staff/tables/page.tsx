"use client";

import { PaymentConfirmSheet } from "@/components/staff/PaymentConfirmSheet";
import { TableCard } from "@/components/staff/TableCard";
import { TableDetailSheet } from "@/components/staff/TableDetailSheet";
import { TableListRow } from "@/components/staff/TableListRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTables } from "@/hooks/useTables";
import { useZones } from "@/hooks/useZones";
import { updateTableStatus } from "@/services/table.service";
import type { TableWithOrders } from "@/types";
import { LayoutGrid, List } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ALL_ZONES = "all" as const;

export default function StaffTablesPage() {
  const { tables, loading: tablesLoading } = useTables();
  const { zones, loading: zonesLoading } = useZones();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [paymentTableId, setPaymentTableId] = useState<string | null>(null);
  // Module 13: lọc theo khu vực (tab) + chuyển đổi Lưới/Danh sách.
  const [activeZone, setActiveZone] = useState<string>(ALL_ZONES);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const loading = tablesLoading || zonesLoading;

  // Luôn lấy bản mới nhất từ danh sách (thay vì giữ snapshot cũ) để sheet tự
  // cập nhật realtime theo dữ liệu mà useTables vừa refetch.
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const paymentTable = tables.find((t) => t.id === paymentTableId) ?? null;

  const zoneNameById = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), [zones]);

  const visibleTables = useMemo(
    () => (activeZone === ALL_ZONES ? tables : tables.filter((t) => t.zone_id === activeZone)),
    [tables, activeZone]
  );

  function handlePrintReceipt(table: TableWithOrders) {
    window.open(`/staff/tables/print?table=${table.id}`, "_blank", "noopener,noreferrer");
  }

  /**
   * "Gọi món hộ" (Module 12) — mở màn hình đặt món CỦA CHÍNH BÀN ĐÓ trên
   * thiết bị nhân viên đang cầm, cho khách không rành quét QR. Dùng CÙNG query
   * param `?table=<table_number>` mà QR code thật đang trỏ tới (xem
   * TableContext.tsx) — KHÔNG dùng `table_id` (dù đã có sẵn trong tay từ
   * `table.id`) để không phải mở thêm 1 nhánh xử lý mới trong TableContext chỉ
   * để phục vụ đúng 1 điểm vào này; mở tab mới (giống "In hoá đơn") để không
   * mất lưới quản lý bàn đang xem.
   */
  function handleOrderForCustomer(table: TableWithOrders) {
    window.open(`/order?table=${table.table_number}`, "_blank", "noopener,noreferrer");
  }

  /**
   * "Bàn dọn dẹp" -> "Bàn trống" (Module 13): nhân viên bấm 1 chạm ngay trên
   * thẻ/dòng bàn, không cần mở chi tiết bàn. Không cần tự refetch — useTables
   * đã lắng nghe realtime trên bảng `tables` (subscribeToTableChanges) nên
   * lưới/danh sách tự cập nhật ngay sau khi update thành công.
   */
  async function handleMarkCleaned(table: TableWithOrders) {
    try {
      await updateTableStatus(table.id, "available");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái bàn.");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Quản lý bàn ({tables.length} bàn)</h1>

        {/* Module 13: chuyển đổi Lưới/Danh sách. */}
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Xem dạng lưới"
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Xem dạng danh sách"
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {zones.length > 0 && (
        <Tabs value={activeZone} onValueChange={setActiveZone} className="mb-4">
          <TabsList>
            <TabsTrigger value={ALL_ZONES}>Tất cả</TabsTrigger>
            {zones.map((zone) => (
              <TabsTrigger key={zone.id} value={zone.id}>
                {zone.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibleTables.map((table) => (
            <div key={table.id} className={table.shape === "rectangle" ? "sm:col-span-2" : undefined}>
              <TableCard
                table={table}
                onClick={() => setSelectedTableId(table.id)}
                onOrderForCustomer={handleOrderForCustomer}
                onMarkCleaned={(t) => void handleMarkCleaned(t)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTables.map((table) => (
            <TableListRow
              key={table.id}
              table={table}
              zoneName={table.zone_id ? zoneNameById.get(table.zone_id) ?? null : null}
              onClick={() => setSelectedTableId(table.id)}
              onOrderForCustomer={handleOrderForCustomer}
              onMarkCleaned={(t) => void handleMarkCleaned(t)}
            />
          ))}
        </div>
      )}

      <TableDetailSheet
        table={selectedTable}
        onOpenChange={(open) => !open && setSelectedTableId(null)}
        onPrintReceipt={handlePrintReceipt}
        onOpenPayment={(table) => {
          setSelectedTableId(null);
          setPaymentTableId(table.id);
        }}
      />

      <PaymentConfirmSheet
        table={paymentTable}
        onOpenChange={(open) => !open && setPaymentTableId(null)}
        onConfirmed={() => setPaymentTableId(null)}
      />
    </div>
  );
}
