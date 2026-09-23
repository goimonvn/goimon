"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentProfile, signInWithPassword } from "@/services/auth.service";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  "no-role": "Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ chủ quán.",
};

/**
 * Form đăng nhập chung cho khu vực Nhân viên (/staff) và Chủ quán (/admin).
 * Không có luồng đăng ký — tài khoản được chủ quán tạo thủ công qua Supabase
 * Dashboard (xem ghi chú trong supabase/schema.sql).
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      const current = await getCurrentProfile();

      if (!current) {
        toast.error("Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ chủ quán.");
        return;
      }

      const destination =
        redirectTo ?? (current.profile.role === "admin" ? "/admin/dashboard" : "/staff/tables");
      router.push(destination);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-bold text-primary">Gọi Món</p>
          <p className="text-sm text-muted-foreground">Đăng nhập khu vực Nhân viên / Chủ quán</p>
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Mật khẩu</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
