"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { Suspense } from "react";

/**
 * `useSearchParams` (đọc `?redirect=`/`?error=` do middleware gắn vào khi
 * chặn truy cập /staff, /admin) bắt buộc phải nằm trong Suspense theo yêu cầu
 * của Next.js App Router khi render tĩnh.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
