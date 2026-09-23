"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomer } from "@/contexts/CustomerContext";
import { Gift, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PHONE_PATTERN = /^0\d{8,9}$/;

/**
 * Thẻ nhập SĐT ở bước giỏ hàng (trước khi gửi đơn) — tra cứu/tự đăng ký
 * thành viên thân thiết. HOÀN TOÀN TUỲ CHỌN: khách bỏ qua vẫn gửi đơn bình
 * thường, chỉ là không được cộng điểm cho đơn đó.
 */
export function PhoneLookupCard() {
  const { customer, loading, identifyByPhone, clearCustomer } = useCustomer();
  const [phone, setPhone] = useState("");

  async function handleLookup() {
    const trimmed = phone.trim();
    if (!PHONE_PATTERN.test(trimmed)) {
      toast.error("Số điện thoại không hợp lệ (bắt đầu bằng 0, 9-10 số).");
      return;
    }
    try {
      const identity = await identifyByPhone(trimmed);
      toast.success(
        identity.isNew
          ? "Đã đăng ký thành viên mới! Đơn này sẽ được tích điểm."
          : `Xin chào lại! Bạn đang có ${identity.points} điểm.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tra cứu thông tin thành viên.");
    }
  }

  if (customer) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Gift className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Thành viên <span className="font-medium">{customer.phone}</span> · {customer.points} điểm — đơn này sẽ
            được tích điểm.
          </span>
        </div>
        <button
          type="button"
          aria-label="Bỏ chọn thành viên"
          onClick={clearCustomer}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Gift className="h-4 w-4 text-primary" />
        Tích điểm thành viên (không bắt buộc)
      </p>
      <div className="flex gap-2">
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="Nhập số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button variant="outline" disabled={loading} onClick={() => void handleLookup()}>
          {loading ? "..." : "Tra cứu"}
        </Button>
      </div>
    </div>
  );
}
