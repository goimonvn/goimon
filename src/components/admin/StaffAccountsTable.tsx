"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { USER_ROLE_LABEL } from "@/types";
import type { ProfilesRow, UserRole } from "@/types/database.types";
import { Trash2 } from "lucide-react";

interface StaffAccountsTableProps {
  accounts: ProfilesRow[];
  loading: boolean;
  /** id tài khoản đang đăng nhập — dùng để KHOÁ đổi role/xoá trên chính dòng của mình (tránh tự khoá mình khỏi `/admin`, xem staff.service.ts). */
  currentUserId: string | null;
  onChangeRole: (account: ProfilesRow, role: UserRole) => void;
  onDelete: (account: ProfilesRow) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Bảng danh sách tài khoản nhân viên/chủ quán — đổi role NGAY qua Select inline (giống Switch bật/tắt ở PromotionsTable/CombosTable), không cần mở dialog riêng. */
export function StaffAccountsTable({
  accounts,
  loading,
  currentUserId,
  onChangeRole,
  onDelete,
}: StaffAccountsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Chưa có tài khoản nào.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Họ tên</th>
            <th className="px-4 py-3 font-medium">Vai trò</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Ngày tạo</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const isSelf = account.id === currentUserId;
            return (
              <tr key={account.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 font-medium">
                    {account.email}
                    {isSelf && <Badge variant="secondary">Bạn</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground sm:hidden">{account.full_name ?? "—"}</div>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{account.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Select
                    value={account.role}
                    disabled={isSelf}
                    onValueChange={(v) => onChangeRole(account, v as UserRole)}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(USER_ROLE_LABEL) as UserRole[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {USER_ROLE_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                  {formatDateTime(account.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={isSelf}
                      onClick={() => onDelete(account)}
                      aria-label="Xoá"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
