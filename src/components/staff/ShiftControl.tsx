"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveShift } from "@/hooks/useActiveShift";
import { Clock } from "lucide-react";
import { useState } from "react";
import { EndShiftDialog } from "./EndShiftDialog";
import { StartShiftDialog } from "./StartShiftDialog";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Widget chấm công gắn ở `StaffNav` (hiển thị trên mọi trang `/staff/*`):
 * hiện nút "Bắt đầu ca" khi chưa có ca mở, hoặc badge giờ bắt đầu + nút
 * "Kết thúc ca" khi đang có ca — nhân viên luôn thấy trạng thái ca của mình
 * dù đang ở trang Quản lý bàn hay KDS.
 */
export function ShiftControl() {
  const { activeShift, loading, refetch } = useActiveShift();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  if (loading) return null;

  return (
    <>
      {activeShift ? (
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="success" className="hidden items-center gap-1 sm:inline-flex">
            <Clock className="h-3 w-3" />
            Đang mở ca · {formatTime(activeShift.start_time)}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setEndOpen(true)}>
            Kết thúc ca
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setStartOpen(true)}>
          Bắt đầu ca
        </Button>
      )}

      <StartShiftDialog open={startOpen} onOpenChange={setStartOpen} onStarted={refetch} />
      <EndShiftDialog open={endOpen} shift={activeShift} onOpenChange={setEndOpen} onClosed={refetch} />
    </>
  );
}
