"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ORDER_TYPE_LABEL } from "@/types";
import type { OrderType } from "@/types/database.types";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";

interface TakeawaySectionProps {
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  /** Giá trị thô của input[type=datetime-local] ("yyyy-MM-ddTHH:mm"), rỗng nếu khách không chọn giờ cụ thể. */
  pickupTime: string;
  onPickupTimeChange: (value: string) => void;
}

/**
 * Toggle "Ăn tại bàn" / "Đặt mang đi" + form thông tin khách khi chọn mang đi
 * (Module 13) — đặt ở trang giỏ hàng (`/order/cart`), KHÔNG phải 1 điểm vào
 * riêng biệt: xem quyết định thiết kế đầy đủ ở order.service.ts#createOrder.
 * Chọn "Đặt mang đi" KHÔNG ảnh hưởng tới bàn khách đang ngồi (nếu có) — đơn
 * mang đi luôn độc lập, không gắn với bàn nào.
 */
export function TakeawaySection({
  orderType,
  onOrderTypeChange,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  pickupTime,
  onPickupTimeChange,
}: TakeawaySectionProps) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-3">
      <Tabs value={orderType} onValueChange={(v) => onOrderTypeChange(v as OrderType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dine_in" className="gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            {ORDER_TYPE_LABEL.dine_in}
          </TabsTrigger>
          <TabsTrigger value="takeaway" className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            {ORDER_TYPE_LABEL.takeaway}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {orderType === "takeaway" && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="takeaway-name">Tên khách</Label>
            <Input
              id="takeaway-name"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Ví dụ: Anh Phong"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="takeaway-phone">Số điện thoại</Label>
            <Input
              id="takeaway-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              placeholder="Ví dụ: 0901234567"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="takeaway-pickup-time">Giờ hẹn lấy (không bắt buộc)</Label>
            <Input
              id="takeaway-pickup-time"
              type="datetime-local"
              value={pickupTime}
              onChange={(e) => onPickupTimeChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Để trống nếu bạn muốn lấy sớm nhất có thể.</p>
          </div>
        </div>
      )}
    </div>
  );
}
