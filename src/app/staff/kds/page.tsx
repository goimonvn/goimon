"use client";

import { KdsItemCard } from "@/components/staff/KdsItemCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNow } from "@/hooks/useNow";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useStationQueue } from "@/hooks/useStationQueue";
import { updateOrderItemStatus } from "@/services/order.service";
import { NEXT_ORDER_ITEM_STATUS, type KdsTicket } from "@/types";
import type { StationType } from "@/types/database.types";
import { ChefHat, Coffee, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATIONS: { value: StationType; label: string; icon: LucideIcon }[] = [
  { value: "bar", label: "Quầy Bar", icon: Coffee },
  { value: "kitchen", label: "Quầy Bếp", icon: ChefHat },
];

function StationBoard({ station }: { station: StationType }) {
  const { tickets, loading } = useStationQueue(station);
  const now = useNow(15000);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  async function handleAdvance(ticket: KdsTicket) {
    const nextStatus = NEXT_ORDER_ITEM_STATUS[ticket.item_status];
    if (!nextStatus) return;

    setAdvancingId(ticket.id);
    try {
      const { insufficientIngredients } = await updateOrderItemStatus(ticket.id, nextStatus);
      if (insufficientIngredients.length > 0) {
        toast.warning(
          `Sắp/đã hết nguyên liệu: ${insufficientIngredients.join(", ")} — đã trừ kho, báo quản lý nhập thêm.`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái món.");
    } finally {
      setAdvancingId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Không có món nào đang chờ xử lý. 🎉
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tickets.map((ticket) => (
        <KdsItemCard
          key={ticket.id}
          ticket={ticket}
          now={now}
          advancing={advancingId === ticket.id}
          onAdvance={handleAdvance}
        />
      ))}
    </div>
  );
}

export default function KdsPage() {
  usePageTitle("Màn hình bếp / pha chế (KDS)");
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Màn hình bếp / pha chế (KDS)</h1>
      <Tabs defaultValue="bar">
        <TabsList>
          {STATIONS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {STATIONS.map(({ value }) => (
          <TabsContent key={value} value={value}>
            <StationBoard station={value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
