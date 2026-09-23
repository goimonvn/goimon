"use client";

import { getAllStaffAccounts, subscribeToStaffAccountChanges } from "@/services/staff.service";
import type { ProfilesRow } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseStaffAccountsResult {
  accounts: ProfilesRow[];
  loading: boolean;
  refetch: () => void;
}

/** Toàn bộ tài khoản nhân viên/chủ quán, tự làm mới realtime — dùng cho `/admin/staff`. */
export function useStaffAccounts(): UseStaffAccountsResult {
  const [accounts, setAccounts] = useState<ProfilesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAllStaffAccounts();
        if (!cancelled) setAccounts(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách tài khoản.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToStaffAccountChanges(refetch);

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [reloadToken, refetch]);

  return { accounts, loading, refetch };
}
