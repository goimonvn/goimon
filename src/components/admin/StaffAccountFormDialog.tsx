"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStaffAccount } from "@/services/staff.service";
import { USER_ROLE_LABEL } from "@/types";
import type { UserRole } from "@/types/database.types";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

interface StaffAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/**
 * Form tạo tài khoản nhân viên/chủ quán mới — CHỈ tạo mới, không dùng để sửa
 * (đổi role làm trực tiếp bằng Select inline trong `StaffAccountsTable`, xem
 * ghi chú ở đó). Mật khẩu nhập ở đây là mật khẩu TẠM — nên nhắc nhân viên tự
 * đổi lại sau lần đăng nhập đầu tiên (chưa có luồng "bắt buộc đổi mật khẩu",
 * nằm ngoài phạm vi hiện tại).
 */
export function StaffAccountFormDialog({ open, onOpenChange, onCreated }: StaffAccountFormDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("staff");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (password.length < 6) {
      toast.error("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }

    setSubmitting(true);
    try {
      await createStaffAccount({ email: trimmedEmail, password, fullName: fullName.trim(), role });
      toast.success("Đã tạo tài khoản mới.");
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo tài khoản mới.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm tài khoản nhân viên</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhanvien@vidu.com"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-password">Mật khẩu tạm</Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
            />
            <p className="text-xs text-muted-foreground">Nên nhắc nhân viên tự đổi lại sau lần đăng nhập đầu tiên.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-full-name">Họ tên (không bắt buộc)</Label>
            <Input
              id="staff-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
