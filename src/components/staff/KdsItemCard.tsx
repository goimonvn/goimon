"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ADVANCE_ACTION_LABEL,
  KDS_DANGER_MINUTES,
  KDS_WARN_MINUTES,
  NEXT_ORDER_ITEM_STATUS,
  ORDER_ITEM_STATUS_LABEL,
  type KdsTicket,
} from "@/types";
import { Clock } from "lucide-react";

interface KdsItemCardProps {
  ticket: KdsTicket;
  now: Date;
  onAdvance: (ticket: KdsTicket) => void;
  advancing: boolean;
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return "Vừa đặt";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} giờ ${rest} phút`;
}

export function KdsItemCard({ ticket, now, onAdvance, advancing }: KdsItemCardProps) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(ticket.created_at).getTime()) / 60000)
  );
  const isDanger = elapsedMinutes >= KDS_DANGER_MINUTES;
  const isWarn = !isDanger && elapsedMinutes >= KDS_WARN_MINUTES;

  const nextStatus = NEXT_ORDER_ITEM_STATUS[ticket.item_status];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 p-4 shadow-sm transition-colors",
        isDanger
          ? "border-destructive bg-destructive/10"
          : isWarn
            ? "border-amber-400 bg-amber-50"
            : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-foreground px-2.5 py-1 text-sm font-bold text-background">
          Bàn {ticket.table_number ?? "?"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            isDanger ? "text-destructive" : isWarn ? "text-amber-700" : "text-muted-foreground"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {formatElapsed(elapsedMinutes)}
        </span>
      </div>

      <div>
        {ticket.combo_name && (
          <p className="mb-1 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
            🎁 Combo: {ticket.combo_name}
          </p>
        )}
        <p className="text-base font-semibold leading-snug">
          {ticket.quantity}x {ticket.menu_item_name}
        </p>
        {ticket.notes && (
          <p className="mt-1 text-sm italic text-muted-foreground">{ticket.notes}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {ORDER_ITEM_STATUS_LABEL[ticket.item_status]}
        </span>
        {nextStatus && (
          <Button size="sm" disabled={advancing} onClick={() => onAdvance(ticket)}>
            {ADVANCE_ACTION_LABEL[ticket.item_status]}
          </Button>
        )}
      </div>
    </div>
  );
}
