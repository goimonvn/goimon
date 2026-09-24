"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createZone, updateZone } from "@/services/zone.service";
import type { ZonesRow } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type ZoneSummary = Pick<ZonesRow, "id" | "name" | "display_order">;

interface ZoneFormDialogProps {
  open: boolean;
  zone: ZoneSummary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Form thêm/sửa khu vực (Tầng 1, Tầng 2, Sân vườn...) — dùng chung 1 component cho cả 2 thao tác, phân biệt qua `zone` (null = tạo mới). */
export function ZoneFormDialog({ open, zone, onOpenChange, onSaved }: ZoneFormDialogProps) {
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(zone?.name ?? "");
      setDisplayOrder(zone ? String(zone.display_order) : "0");
    }
  }, [open, zone]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên khu vực.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: trimmedName, displayOrder: Number(displayOrder) || 0 };
      if (zone) {
        await updateZone(zone.id, input);
        toast.success("Đã cập nhật khu vực.");
      } else {
        await createZone(input);
        toast.success("Đã tạo khu vực mới.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu khu vực.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{zone ? "Sửa khu vực" : "Thêm khu vực mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="zone-name">Tên khu vực</Label>
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Tầng 1, Tầng 2, Sân vườn..."
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-order">Thứ tự hiển thị</Label>
            <Input
              id="zone-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Số nhỏ hơn hiển thị trước trong tab lọc ở màn hình nhân viên.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
