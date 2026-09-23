"use client";

import { customerStorageKey } from "@/lib/utils";
import { findOrCreateCustomerByPhone, getCustomerById } from "@/services/customer.service";
import type { CustomerIdentity } from "@/types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTable } from "./TableContext";

interface StoredCustomer {
  id: string;
  phone: string;
}

interface CustomerContextValue {
  customer: CustomerIdentity | null;
  loading: boolean;
  /** Tra cứu/đăng ký thành viên theo SĐT (bước giỏ hàng) — trả về identity vừa xác định để component gọi dùng ngay, không cần đợi state cập nhật. */
  identifyByPhone: (phone: string) => Promise<CustomerIdentity>;
  /** Tải lại số điểm hiện tại (gọi sau khi thanh toán xong để widget cập nhật điểm mới cộng). */
  refresh: () => Promise<void>;
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined);

/**
 * Danh tính khách hàng thân thiết cho phiên gọi món hiện tại — lưu localStorage
 * THEO BÀN (giống CartContext) để khách mới ngồi vào bàn cũ không kế thừa
 * nhầm danh tính/điểm của khách trước. Khác CartContext, dữ liệu gốc (điểm,
 * lịch sử) luôn nằm ở Supabase — localStorage chỉ lưu `id`/`phone` để biết
 * "khách này đang được nhận diện", còn điểm luôn tải lại mới nhất từ server.
 */
export function CustomerProvider({ children }: { children: ReactNode }) {
  const { table } = useTable();
  const storageKey = table ? customerStorageKey(table.id) : null;
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [loading, setLoading] = useState(false);

  const persist = useCallback(
    (next: CustomerIdentity | null) => {
      setCustomer(next);
      if (!storageKey) return;
      try {
        if (next) {
          const payload: StoredCustomer = { id: next.id, phone: next.phone };
          window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // Bỏ qua lỗi lưu trữ cục bộ — khách vẫn tra cứu lại được trong phiên hiện tại.
      }
    },
    [storageKey]
  );

  useEffect(() => {
    if (!storageKey) {
      setCustomer(null);
      return;
    }

    let cancelled = false;

    let stored: StoredCustomer | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      stored = raw ? (JSON.parse(raw) as StoredCustomer) : null;
    } catch {
      stored = null;
    }

    if (!stored) {
      setCustomer(null);
      return;
    }

    setLoading(true);
    void getCustomerById(stored.id)
      .then((found) => {
        if (!cancelled) setCustomer(found);
      })
      .catch(() => {
        if (!cancelled) setCustomer(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const identifyByPhone = useCallback(
    async (phone: string): Promise<CustomerIdentity> => {
      setLoading(true);
      try {
        const identity = await findOrCreateCustomerByPhone(phone);
        persist(identity);
        return identity;
      } finally {
        setLoading(false);
      }
    },
    [persist]
  );

  const refresh = useCallback(async () => {
    if (!customer) return;
    const found = await getCustomerById(customer.id);
    if (found) setCustomer(found);
  }, [customer]);

  const clearCustomer = useCallback(() => persist(null), [persist]);

  const value = useMemo<CustomerContextValue>(
    () => ({ customer, loading, identifyByPhone, refresh, clearCustomer }),
    [customer, loading, identifyByPhone, refresh, clearCustomer]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer phải được dùng bên trong CustomerProvider");
  return ctx;
}
