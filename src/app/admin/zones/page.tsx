"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ZoneFormDialog } from "@/components/admin/ZoneFormDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useZones } from "@/hooks/useZones";
import { usePageTitle } from "@/hooks/usePageTitle";
import { assignTableZone, getAllTables, updateTableShape } from "@/services/table.service";
import { deleteZone, getZonesWithTables } from "@/services/zone.service";
import { TABLE_SHAPE_LABEL, type ZoneWithTables } from "@/types";
import type { TableShape, TablesRow, ZonesRow } from "@/types/database.types";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ZoneSummary = Pick<ZonesRow, "id" | "name" | "display_order">;
type ZoneDialogState = { mode: "create" } | { mode: "edit"; zone: ZoneSummary } | null;

const NO_ZONE = "none" as const;

/**
 * Quản lý khu vực (Module 13): CRUD danh sách khu vực (Tầng 1, Tầng 2, Sân
 * vườn...) + gán khu vực/hình dạng cho từng bàn — bảng `tables` đã có sẵn
 * `zone_id`/`shape` từ migration nhưng KHÔNG có UI nào gán giá trị cho 15 bàn
 * hiện có, nên trang này bổ sung phần "Gán khu vực & hình dạng cho từng bàn"
 * dù không được yêu cầu tường minh trong spec — thiếu phần này thì tính năng
 * "Sơ đồ Bàn theo Khu vực" sẽ không có cách nào thực sự sử dụng được.
 */
export default function AdminZonesPage() {
  usePageTitle("Khu vực");
  const { zones, loading: zonesLoading } = useZones();
  const [tables, setTables] = useState<TablesRow[]>([]);
  const [zonesWithTables, setZonesWithTables] = useState<ZoneWithTables[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [zoneDialog, setZoneDialog] = useState<ZoneDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingTableId, setSavingTableId] = useState<string | null>(null);

  const loadTablesData = useCallback(async () => {
    setTablesLoading(true);
    try {
      const [tableRows, zonesPreview] = await Promise.all([getAllTables(), getZonesWithTables()]);
      setTables(tableRows);
      setZonesWithTables(zonesPreview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải danh sách bàn.");
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTablesData();
  }, [loadTablesData, zones]);

  async function handleConfirmDeleteZone() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteZone(deleteTarget.id);
      toast.success("Đã xoá khu vực. Các bàn thuộc khu vực này chuyển về \"Chưa gán khu vực\".");
      await loadTablesData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá khu vực.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleAssignZone(tableId: string, zoneId: string) {
    setSavingTableId(tableId);
    try {
      await assignTableZone(tableId, zoneId === NO_ZONE ? null : zoneId);
      await loadTablesData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gán khu vực cho bàn.");
    } finally {
      setSavingTableId(null);
    }
  }

  async function handleAssignShape(tableId: string, shape: TableShape) {
    setSavingTableId(tableId);
    try {
      await updateTableShape(tableId, shape);
      await loadTablesData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật hình dạng bàn.");
    } finally {
      setSavingTableId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Khu vực</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý các khu vực (tầng/sảnh) và gán khu vực, hình dạng cho từng bàn.
          </p>
        </div>
        <Button onClick={() => setZoneDialog({ mode: "create" })}>
          <Plus className="h-4 w-4" />
          Thêm khu vực
        </Button>
      </div>

      {/* Danh sách khu vực + CRUD */}
      {zonesLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : zones.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Chưa có khu vực nào. Bấm &quot;Thêm khu vực&quot; để bắt đầu.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zonesWithTables.map((zone) => (
            <div key={zone.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{zone.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setZoneDialog({
                        mode: "edit",
                        zone: { id: zone.id, name: zone.name, display_order: zone.display_order },
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget({ id: zone.id, label: zone.name })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {zone.tables.length === 0
                  ? "Chưa có bàn nào thuộc khu vực này."
                  : `${zone.tables.length} bàn: ` +
                    zone.tables.map((t) => t.table_number).sort((a, b) => a - b).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Gán khu vực & hình dạng cho từng bàn */}
      <div>
        <h2 className="mb-1 text-base font-semibold">Gán khu vực &amp; hình dạng cho từng bàn</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Chọn khu vực và hình dạng hiển thị cho từng bàn — áp dụng ngay lập tức cho sơ đồ bàn ở màn hình nhân viên.
        </p>

        {tablesLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Bàn</th>
                  <th className="p-3 font-medium">Khu vực</th>
                  <th className="p-3 font-medium">Hình dạng</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold">Bàn {table.table_number}</td>
                    <td className="p-3">
                      <Select
                        value={table.zone_id ?? NO_ZONE}
                        disabled={savingTableId === table.id}
                        onValueChange={(v) => void handleAssignZone(table.id, v)}
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ZONE}>Chưa gán khu vực</SelectItem>
                          {zones.map((zone) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Select
                        value={table.shape}
                        disabled={savingTableId === table.id}
                        onValueChange={(v) => void handleAssignShape(table.id, v as TableShape)}
                      >
                        <SelectTrigger className="h-9 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TABLE_SHAPE_LABEL) as TableShape[]).map((shape) => (
                            <SelectItem key={shape} value={shape}>
                              {TABLE_SHAPE_LABEL[shape]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ZoneFormDialog
        open={zoneDialog !== null}
        zone={zoneDialog?.mode === "edit" ? zoneDialog.zone : null}
        onOpenChange={(open) => !open && setZoneDialog(null)}
        onSaved={() => void loadTablesData()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xoá khu vực?"
        description={`Khu vực "${deleteTarget?.label ?? ""}" sẽ bị xoá. Các bàn thuộc khu vực này KHÔNG bị xoá, chỉ chuyển về "Chưa gán khu vực".`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDeleteZone()}
      />
    </div>
  );
}
