import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { ORDER_ITEM_STATUS_LABEL, type OrderWithItems } from "@/types";
import type { OrderItemStatus } from "@/types/database.types";
import { Check, ChefHat, Clock, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";

const STATUS_ICON: Record<OrderItemStatus, ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  preparing: <ChefHat className="h-4 w-4" />,
  ready: <Check className="h-4 w-4" />,
  served: <UtensilsCrossed className="h-4 w-4" />,
};

const STATUS_VARIANT: Record<OrderItemStatus, "secondary" | "warning" | "success" | "outline"> = {
  pending: "secondary",
  preparing: "warning",
  ready: "success",
  served: "outline",
};

interface OrderStatusCardProps {
  order: OrderWithItems;
}

export function OrderStatusCard({ order }: OrderStatusCardProps) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Đơn #{order.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-sm font-semibold">{formatCurrency(order.total_amount)}</p>
      </div>

      <ul className="space-y-2">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              {item.quantity}x {item.menu_item?.name ?? "Món"}
              {item.combo_name && (
                <span className="ml-1.5 text-xs text-muted-foreground">(Combo: {item.combo_name})</span>
              )}
            </span>
            <Badge
              variant={STATUS_VARIANT[item.item_status]}
              className={cn("gap-1", item.item_status === "ready" && "animate-pulse")}
            >
              {STATUS_ICON[item.item_status]}
              {ORDER_ITEM_STATUS_LABEL[item.item_status]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
