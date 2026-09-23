"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  onLogout: () => void;
}

/** Nút đăng xuất dùng chung cho header của /staff và /admin. */
export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onLogout}
      className="shrink-0 gap-1.5 text-muted-foreground"
    >
      <LogOut className="h-4 w-4" />
      Đăng xuất
    </Button>
  );
}
