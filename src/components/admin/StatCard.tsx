import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  className?: string;
}

/**
 * Thẻ thống kê đơn — value dùng chữ số tỉ lệ (proportional figures) thay vì
 * tabular-nums vì đây là con số hiển thị lớn, đứng riêng lẻ (theo quy ước
 * "hero/stat-tile" của hệ thống biểu đồ), không phải cột số cần canh hàng.
 */
export function StatCard({ label, value, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
