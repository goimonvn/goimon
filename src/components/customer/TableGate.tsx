"use client";

import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTable } from "@/contexts/TableContext";
import { QrCode } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Chặn render nội dung đặt món khi chưa xác định được bàn hợp lệ.
 * Dùng chung cho mọi trang trong nhánh /order để không lặp lại logic kiểm tra.
 */
export function TableGate({ children }: { children: ReactNode }) {
  const { table, loading, notFound } = useTable();

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !table) {
    return (
      <EmptyState
        icon={<QrCode className="h-10 w-10 text-muted-foreground" />}
        title="Không xác định được bàn"
        description="Vui lòng quét mã QR được dán tại bàn để bắt đầu gọi món."
      />
    );
  }

  return <>{children}</>;
}
