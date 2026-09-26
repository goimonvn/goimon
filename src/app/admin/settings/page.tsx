"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useDeliverySettings } from "@/hooks/useDeliverySettings";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { PaymentConfigValue } from "@/types/database.types";
import { Banknote, Bike, QrCode, Wallet, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

interface SettingToggleRow {
  key: keyof PaymentConfigValue;
  icon: LucideIcon;
  label: string;
  description: string;
}

/**
 * Module 17 — Cấu hình Linh hoạt Phương thức Thanh toán. Đúng 4 dòng, khớp
 * 1:1 với 4 cờ trong `PaymentConfigValue` (xem database.types.ts) — không gộp
 * "Tiền mặt" và "Yêu cầu thanh toán tại bàn" thành 1 công tắc dù chúng hay đi
 * cùng nhau trong thực tế vận hành, vì đây là 2 khái niệm ĐỘC LẬP: tắt "Yêu
 * cầu thanh toán tại bàn" chỉ ẩn luồng khách tự gọi nhân viên ra thu tiền
 * (CheckoutSheet), còn "Tiền mặt" quyết định phương thức tiền mặt có xuất hiện
 * hay không ở CẢ màn khách LẪN màn nhân viên xác nhận thanh toán
 * (PaymentConfirmSheet) — 1 quán có thể muốn tắt tiền mặt (chỉ nhận chuyển
 * khoản) nhưng vẫn giữ luồng "khách tự yêu cầu nhân viên ra xử lý".
 */
const SETTING_ROWS: SettingToggleRow[] = [
  {
    key: "enable_payos",
    icon: Zap,
    label: "Thanh toán Tự động PayOS",
    description: "QR động, hệ thống tự xác nhận ngay khi khách chuyển khoản.",
  },
  {
    key: "enable_static_qr",
    icon: QrCode,
    label: "Mã VietQR Cố định",
    description: "QR tĩnh, nhân viên tự xác nhận thanh toán bằng mắt.",
  },
  {
    key: "enable_cash",
    icon: Banknote,
    label: "Thanh toán Tiền mặt",
    description: "Cho phép thanh toán bằng tiền mặt.",
  },
  {
    key: "enable_pay_at_table",
    icon: Wallet,
    label: "Yêu cầu Thanh toán tại bàn",
    description: "Khách gửi yêu cầu để nhân viên ra xử lý thanh toán tại bàn.",
  },
];

/**
 * Cấu hình kênh Giao tận nơi (Module 19) — 2 công tắc (giống khuôn mẫu
 * `SETTING_ROWS` ở trên) + 2 ô nhập số (phí ship mặc định/ngưỡng freeship).
 * Tách thành component riêng (thay vì gộp chung mảng `SETTING_ROWS`) vì có
 * thêm 2 input số — không thuần "danh sách công tắc" như payment_config.
 */
function DeliverySettingsSection() {
  const { settings, loading, updating, updateSetting } = useDeliverySettings();
  const [baseFeeDraft, setBaseFeeDraft] = useState("");
  const [thresholdDraft, setThresholdDraft] = useState("");

  if (loading || !settings) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex gap-3">
          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <Label htmlFor="toggle-delivery" className="cursor-pointer font-medium">
              Kênh Giao tận nơi
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Bật/tắt toàn bộ trang <code>/delivery</code>.
            </p>
          </div>
        </div>
        <Switch
          id="toggle-delivery"
          checked={settings.enable_delivery}
          disabled={updating}
          onCheckedChange={(checked) => void updateSetting("enable_delivery", checked)}
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex gap-3">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <Label htmlFor="toggle-cod" className="cursor-pointer font-medium">
              Thanh toán khi nhận hàng (COD)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Cho phép khách trả tiền mặt khi nhận hàng.
            </p>
          </div>
        </div>
        <Switch
          id="toggle-cod"
          checked={settings.enable_cod}
          disabled={updating}
          onCheckedChange={(checked) => void updateSetting("enable_cod", checked)}
        />
      </div>

      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="base-shipping-fee">Phí ship mặc định (đ)</Label>
          <Input
            id="base-shipping-fee"
            type="number"
            min={0}
            defaultValue={settings.base_shipping_fee}
            onChange={(e) => setBaseFeeDraft(e.target.value)}
            onBlur={() => {
              const value = Number(baseFeeDraft);
              if (baseFeeDraft === "" || Number.isNaN(value) || value < 0) return;
              void updateSetting("base_shipping_fee", value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="free-shipping-threshold">Miễn phí ship từ (đ)</Label>
          <Input
            id="free-shipping-threshold"
            type="number"
            min={0}
            defaultValue={settings.free_shipping_threshold}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onBlur={() => {
              const value = Number(thresholdDraft);
              if (thresholdDraft === "" || Number.isNaN(value) || value < 0) return;
              void updateSetting("free_shipping_threshold", value);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Đơn đạt mức này sẽ tự động miễn phí ship.
        </p>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  usePageTitle("Cấu hình thanh toán");
  const { settings, loading, updating, updateSetting } = usePaymentSettings();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Cấu hình thanh toán</h1>
        <p className="text-sm text-muted-foreground">
          Áp dụng ngay lập tức cho màn hình khách và nhân viên, không cần deploy lại.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {SETTING_ROWS.map(({ key, icon: Icon, label, description }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <Label htmlFor={`toggle-${key}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                id={`toggle-${key}`}
                checked={settings?.[key] ?? true}
                disabled={updating}
                onCheckedChange={(checked) => void updateSetting(key, checked)}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold">Cấu hình Giao tận nơi</h2>
        <p className="text-sm text-muted-foreground">
          Cài đặt cho trang <code>/delivery</code>.
        </p>
      </div>
      <DeliverySettingsSection />
    </div>
  );
}
