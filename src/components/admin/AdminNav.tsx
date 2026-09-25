"use client";

import { LogoutButton } from "@/components/shared/LogoutButton";
import { cn } from "@/lib/utils";
import { USER_ROLE_LABEL } from "@/types";
import type { ProfilesRow } from "@/types/database.types";
import { BarChart3, Boxes, Clock, Gift, LayoutDashboard, MapPin, ReceiptText, Settings2, Star, Ticket, Users, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Quản lý menu", icon: UtensilsCrossed },
  { href: "/admin/zones", label: "Khu vực", icon: MapPin },
  { href: "/admin/combos", label: "Combo", icon: Gift },
  { href: "/admin/inventory", label: "Kho hàng", icon: Boxes },
  { href: "/admin/promotions", label: "Khuyến mãi", icon: Ticket },
  { href: "/admin/shifts", label: "Ca làm việc", icon: Clock },
  { href: "/admin/expenses", label: "Chi phí", icon: Wallet },
  { href: "/admin/analytics", label: "Phân tích", icon: BarChart3 },
  { href: "/admin/vat-invoices", label: "Hoá đơn VAT", icon: ReceiptText },
  { href: "/admin/feedbacks", label: "Đánh giá", icon: Star },
  { href: "/admin/staff", label: "Nhân viên", icon: Users },
  { href: "/admin/settings", label: "Cấu hình", icon: Settings2 },
];

interface AdminNavProps {
  profile: ProfilesRow | null;
  onLogout: () => void;
}

export function AdminNav({ profile, onLogout }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 flex items-center gap-1 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur">
      <span className="mr-4 shrink-0 text-sm font-bold text-primary">Gọi Món · Chủ quán</span>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {profile && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {profile.full_name ?? profile.email} · {USER_ROLE_LABEL[profile.role]}
          </span>
        )}
        <LogoutButton onLogout={onLogout} />
      </div>
    </nav>
  );
}
