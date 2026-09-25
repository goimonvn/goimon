"use client";

import { LogoutButton } from "@/components/shared/LogoutButton";
import { cn } from "@/lib/utils";
import { USER_ROLE_LABEL } from "@/types";
import type { ProfilesRow } from "@/types/database.types";
import { Bike, CalendarClock, ChefHat, LayoutGrid, Utensils } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShiftControl } from "./ShiftControl";

const NAV_ITEMS = [
  { href: "/staff/tables", label: "Quản lý bàn", icon: LayoutGrid },
  { href: "/staff/reservations", label: "Đặt bàn", icon: CalendarClock },
  { href: "/staff/orders", label: "Đơn giao hàng", icon: Bike },
  { href: "/staff/kds", label: "Bếp / Pha chế", icon: ChefHat },
  { href: "/staff/menu-control", label: "Hết món nhanh", icon: Utensils },
];

interface StaffNavProps {
  profile: ProfilesRow | null;
  onLogout: () => void;
}

export function StaffNav({ profile, onLogout }: StaffNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 flex items-center gap-1 overflow-x-auto border-b bg-background/95 px-2 py-2 backdrop-blur">
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
        <ShiftControl />
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
