"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuppliersRow } from "@/types/database.types";
import { Pencil, Trash2 } from "lucide-react";

interface SuppliersTableProps {
  suppliers: SuppliersRow[];
  loading: boolean;
  onEdit: (supplier: SuppliersRow) => void;
  onDelete: (supplier: SuppliersRow) => void;
}

/** Bảng danh sách nhà cung cấp — hỗ trợ sửa + xoá (khác PurchaseReceiptsTable — phiếu nhập chỉ xem, không sửa/xoá). */
export function SuppliersTable({ suppliers, loading, onEdit, onDelete }: SuppliersTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có nhà cung cấp nào — thêm nhà cung cấp trước khi ghi phiếu nhập hàng.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Tên nhà cung cấp</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Điện thoại</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">Địa chỉ</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border-t align-top">
              <td className="px-4 py-3">
                <div className="font-medium">{supplier.name}</div>
                {supplier.note && <div className="max-w-xs truncate text-xs text-muted-foreground">{supplier.note}</div>}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{supplier.phone ?? "—"}</td>
              <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{supplier.address ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <Button size="icon" variant="ghost" onClick={() => onEdit(supplier)} aria-label="Sửa">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(supplier)}
                  aria-label="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
