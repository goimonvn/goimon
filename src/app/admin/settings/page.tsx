"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import type { PaymentConfigValue } from "@/types/database.types";
import { Banknote, QrCode, Wallet, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
    description:
      "Mã VietQR ĐỘNG tự đổi trạng thái khi khách chuyển khoản xong (Module 15) — không cần khách bấm xác nhận, không cần nhân viên thao tác. Tắt cờ này sẽ ẩn nút này ở cả màn khách và nút \"Thanh toán màn hình phụ\" của nhân viên.",
  },
  {
    key: "enable_static_qr",
    icon: QrCode,
    label: "Mã VietQR Cố định",
    description:
      "Mã QR TĨNH dựng từ số tài khoản đã cấu hình trong .env.local (không tự đổi trạng thái, nhân viên xác nhận bằng mắt) — hiện ở màn khách (chuyển khoản thủ công) và màn nhân viên xác nhận thanh toán tại bàn.",
  },
  {
    key: "enable_cash",
    icon: Banknote,
    label: "Thanh toán Tiền mặt",
    description:
      "Cho phép chọn/xác nhận thanh toán bằng tiền mặt — ở cả màn khách chọn phương thức lẫn nút \"Xác nhận đã nhận Tiền mặt\" của nhân viên.",
  },
  {
    key: "enable_pay_at_table",
    icon: Wallet,
    label: "Yêu cầu Thanh toán tại bàn",
    description:
      "Cho phép khách gửi \"Yêu cầu thanh toán\" để nhân viên ra xử lý thủ công tại bàn (chọn tiền mặt/chuyển khoản thủ công bên trên). Tắt cờ này KHÔNG ảnh hưởng luồng PayOS tự động — đó là đường thanh toán độc lập, khách vẫn tự thanh toán được qua PayOS nếu cờ đó còn bật.",
  },
];

export default function AdminSettingsPage() {
  const { settings, loading, updating, updateSetting } = usePaymentSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Cấu hình thanh toán</h1>
        <p className="text-sm text-muted-foreground">
          Bật/tắt từng phương thức thanh toán theo nhu cầu vận hành của quán — áp dụng ngay lập tức cho cả
          màn hình khách và màn hình nhân viên, không cần deploy lại.
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
    </div>
  );
}
