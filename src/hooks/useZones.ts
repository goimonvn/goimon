"use client";

import { getZones, subscribeToZoneChanges } from "@/services/zone.service";
import type { ZonesRow } from "@/types/database.types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseZonesResult {
  zones: ZonesRow[];
  loading: boolean;
}

/** Danh sách khu vực, tự làm mới khi có thêm/sửa/xoá — dùng cho tab lọc `/staff/tables` và trang `/admin/zones`. */
export function useZones(): UseZonesResult {
  const [zones, setZones] = useState<ZonesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getZones();
        if (!cancelled) setZones(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tải danh sách khu vực.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const channel = subscribeToZoneChanges(() => void load());

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, []);

  return { zones, loading };
}
