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
import { getPrinterSettings, savePrinterSettings } from "@/lib/printerSettings";
import { DEFAULT_PRINTER_SETTINGS, type PrinterSettings } from "@/types";
import { Bluetooth, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PrinterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cấu hình máy in nhiệt cho THIẾT BỊ ĐANG DÙNG (lưu localStorage — xem JSDoc
 * `PrinterSettings` trong src/types/index.ts), không lưu Supabase. Mỗi
 * máy/tablet ở quầy có thể cấu hình khác nhau (LAN dùng chung 1 máy in mạng,
 * hoặc mỗi máy ghép Bluetooth riêng).
 */
export function PrinterSettingsDialog({ open, onOpenChange }: PrinterSettingsDialogProps) {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);

  useEffect(() => {
    if (open) setSettings(getPrinterSettings());
  }, [open]);

  function update<K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    savePrinterSettings(settings);
    toast.success("Đã lưu cấu hình máy in trên thiết bị này.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cài đặt máy in nhiệt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cấu hình này chỉ áp dụng cho thiết bị đang dùng (không đồng bộ giữa các máy).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update("connection", "lan")}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                settings.connection === "lan" ? "border-primary bg-primary/5" : ""
              }`}
            >
              <Wifi className="h-6 w-6" />
              <span className="text-sm font-medium">Mạng LAN (IP)</span>
            </button>
            <button
              type="button"
              onClick={() => update("connection", "bluetooth")}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                settings.connection === "bluetooth" ? "border-primary bg-primary/5" : ""
              }`}
            >
              <Bluetooth className="h-6 w-6" />
              <span className="text-sm font-medium">Bluetooth (BLE)</span>
            </button>
          </div>

          {settings.connection === "lan" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="lanIp">Địa chỉ IP máy in</Label>
                <Input
                  id="lanIp"
                  placeholder="192.168.1.100"
                  value={settings.lanIp}
                  onChange={(e) => update("lanIp", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lanPort">Cổng</Label>
                <Input
                  id="lanPort"
                  type="number"
                  value={settings.lanPort}
                  onChange={(e) => update("lanPort", Number(e.target.value) || 9100)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Chỉ hoạt động với máy in Bluetooth Low Energy (BLE) — máy in Bluetooth thường (SPP)
                không kết nối được qua trình duyệt. UUID bên dưới tuỳ theo hãng máy in, xem tài liệu
                đi kèm máy.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="bleServiceUuid">Service UUID</Label>
                <Input
                  id="bleServiceUuid"
                  value={settings.bleServiceUuid}
                  onChange={(e) => update("bleServiceUuid", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bleCharacteristicUuid">Characteristic UUID</Label>
                <Input
                  id="bleCharacteristicUuid"
                  value={settings.bleCharacteristicUuid}
                  onChange={(e) => update("bleCharacteristicUuid", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleSave}>Lưu cấu hình</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
