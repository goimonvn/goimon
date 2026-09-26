"use client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StaffAccountFormDialog } from "@/components/admin/StaffAccountFormDialog";
import { StaffAccountsTable } from "@/components/admin/StaffAccountsTable";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useStaffAccounts } from "@/hooks/useStaffAccounts";
import { deleteStaffAccount, updateStaffRole } from "@/services/staff.service";
import type { ProfilesRow, UserRole } from "@/types/database.types";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Quản lý tài khoản nhân viên/chủ quán (mở rộng Module 4) — thay thế thao
 * tác thủ công qua Supabase Dashboard: thêm tài khoản mới, đổi vai trò, xoá
 * tài khoản. Tạo/xoá đi qua Route Handler server-side vì cần service role
 * key (`/api/admin/staff`, xem services/staff.service.ts); đổi vai trò là
 * UPDATE bình thường qua RLS ("Admin update profiles", xem schema.sql).
 */
export default function AdminStaffPage() {
  usePageTitle("Tài khoản nhân viên");
  const { profile: currentProfile } = useCurrentProfile();
  const { accounts, loading, refetch } = useStaffAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<ProfilesRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const adminCount = accounts.filter((a) => a.role === "admin").length;

  async function handleChangeRole(account: ProfilesRow, role: UserRole) {
    if (role === account.role) return;
    try {
      await updateStaffRole(account.id, role);
      toast.success(`Đã đổi vai trò của ${account.email} thành ${role === "admin" ? "Chủ quán" : "Nhân viên"}.`);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đổi vai trò.");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAccount) return;
    setDeleting(true);
    try {
      await deleteStaffAccount(deletingAccount.id);
      toast.success("Đã xoá tài khoản.");
      setDeletingAccount(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá tài khoản.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tài khoản nhân viên</h1>
          <p className="text-sm text-muted-foreground">
            Thêm/xoá tài khoản nhân viên và chủ quán, đổi vai trò truy cập.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <UserPlus className="mr-1 h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Tổng số tài khoản" value={`${accounts.length}`} icon={Users} />
        <StatCard label="Chủ quán" value={`${adminCount}`} icon={ShieldCheck} />
      </div>

      <StaffAccountsTable
        accounts={accounts}
        loading={loading}
        currentUserId={currentProfile?.id ?? null}
        onChangeRole={(account, role) => void handleChangeRole(account, role)}
        onDelete={setDeletingAccount}
      />

      <StaffAccountFormDialog open={formOpen} onOpenChange={setFormOpen} onCreated={refetch} />

      <ConfirmDialog
        open={deletingAccount !== null}
        title="Xoá tài khoản?"
        description={`Tài khoản "${deletingAccount?.email ?? ""}" sẽ bị xoá vĩnh viễn và không thể đăng nhập lại.`}
        submitting={deleting}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
