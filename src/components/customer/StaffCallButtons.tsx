"use client";

import { Button } from "@/components/ui/button";
import { createStaffCall } from "@/services/staffCall.service";
import type { StaffCallRequestType } from "@/types/database.types";
import { Bell, Snowflake } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

interface StaffCallButtonsProps {
  tableId: string;
  tableNumber: number;
}

const ACTIONS: { type: StaffCallRequestType; label: string; icon: ReactNode }[] = [
  { type: "call_staff", label: "Gọi nhân viên", icon: <Bell className="h-4 w-4" /> },
  { type: "need_ice", label: "Xin thêm đá", icon: <Snowflake className="h-4 w-4" /> },
];

export function StaffCallButtons({ tableId, tableNumber }: StaffCallButtonsProps) {
  const [pendingType, setPendingType] = useState<StaffCallRequestType | null>(null);

  async function handleCall(type: StaffCallRequestType) {
    setPendingType(type);
    try {
      await createStaffCall(tableId, type, tableNumber);
      toast.success("Đã gửi yêu cầu tới nhân viên, vui lòng đợi trong giây lát.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi yêu cầu thất bại.");
    } finally {
      setPendingType(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map((action) => (
        <Button
          key={action.type}
          variant="outline"
          disabled={pendingType !== null}
          onClick={() => void handleCall(action.type)}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
