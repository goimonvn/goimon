"use client";

import { getTableByNumber } from "@/services/table.service";
import { TABLE_STORAGE_KEY } from "@/lib/utils";
import type { TablesRow } from "@/types/database.types";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface StoredTable {
  id: string;
  table_number: number;
}

interface TableContextValue {
  table: TablesRow | null;
  loading: boolean;
  /** true khi đã xác định KHÔNG có bàn hợp lệ (không có query lẫn localStorage, hoặc bàn không tồn tại). */
  notFound: boolean;
}

const TableContext = createContext<TableContextValue | undefined>(undefined);

function readStoredTable(): StoredTable | null {
  try {
    const raw = window.localStorage.getItem(TABLE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTable;
  } catch {
    return null;
  }
}

function writeStoredTable(table: TablesRow): void {
  try {
    const payload: StoredTable = { id: table.id, table_number: table.table_number };
    window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Trình duyệt chặn localStorage (chế độ ẩn danh khắt khe) — không chặn luồng chính.
  }
}

/**
 * Xác định bàn hiện tại theo đúng quy trình vận hành:
 * 1. Ưu tiên query string `?table=` (khách vừa quét QR).
 * 2. Nếu không có, dùng bàn đã lưu localStorage (khách load lại trang / điều hướng nội bộ).
 * 3. Nếu không có cả hai, hoặc số bàn không tồn tại trong DB -> notFound = true.
 */
export function TableProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const tableNumberFromUrl = searchParams.get("table");

  const [table, setTable] = useState<TablesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveTable() {
      setLoading(true);
      setNotFound(false);

      const parsedFromUrl = tableNumberFromUrl ? Number(tableNumberFromUrl) : null;
      const candidateNumber =
        parsedFromUrl && Number.isFinite(parsedFromUrl) && parsedFromUrl > 0
          ? parsedFromUrl
          : readStoredTable()?.table_number ?? null;

      if (candidateNumber === null) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        const found = await getTableByNumber(candidateNumber);
        if (cancelled) return;

        if (!found) {
          setNotFound(true);
          setTable(null);
        } else {
          writeStoredTable(found);
          setTable(found);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolveTable();
    return () => {
      cancelled = true;
    };
  }, [tableNumberFromUrl]);

  const value = useMemo<TableContextValue>(
    () => ({ table, loading, notFound }),
    [table, loading, notFound]
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable(): TableContextValue {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error("useTable phải được dùng bên trong TableProvider");
  return ctx;
}
