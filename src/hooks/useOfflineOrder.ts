"use client";

import { localDb, type LocalOrder } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { useCallback } from "react";

/** 1 món trong đơn gửi lên `submitOrder` — CHỈ `menu_item_id`/`quantity`/`note`, KHÔNG kèm giá (xem ghi chú "Zero Trust" ở sync_offline_order, schema.sql). */
export interface OfflineOrderItemInput {
  menu_item_id: string;
  quantity: number;
  note?: string;
}

/** Input tạo 1 đơn qua luồng Offline-First — CHỈ hỗ trợ đơn tại bàn (Giai đoạn 1, xem schema.sql). */
export interface OfflineOrderPayload {
  table_id: string;
  /** id nhân viên đang tạo đơn (auth.uid()) — dùng để RPC tự tra ca làm việc đang mở, có thể bỏ trống nếu không xác định được. */
  staff_id?: string;
  items: OfflineOrderItemInput[];
}

/** Kết quả trả về NGAY LẬP TỨC cho UI (Optimistic Response) — không phản ánh việc đồng bộ ĐÃ THỰC SỰ xong hay chưa nếu `synced === false`. */
export interface SubmitOrderResult {
  /** Idempotency Key của đơn — dùng để tra cứu lại đúng đơn này sau khi đồng bộ (vd hiển thị trạng thái ở UI). */
  temp_id: string;
  /** true = đã gửi thẳng lên Supabase thành công ngay trong lần gọi này. false = đang lưu đệm ở IndexedDB, chờ SyncManager đồng bộ sau. */
  synced: boolean;
}

async function tryRpcSync(temp_id: string, payload: OfflineOrderPayload): Promise<boolean> {
  const { error } = await supabase.rpc("sync_offline_order", {
    p_temp_id: temp_id,
    p_table_id: payload.table_id,
    p_items: payload.items,
    p_staff_id: payload.staff_id ?? null,
  });
  return !error;
}

/**
 * Module 21 — Offline-First (Giai đoạn 1): hook `useOfflineOrder` cho luồng
 * tạo đơn tại bàn CÓ THỂ mất mạng giữa chừng. `submitOrder` LUÔN trả về ngay
 * (Optimistic UI, không chờ mạng) — UI gọi hook này thay vì gọi thẳng
 * `order.service.ts#createOrder` khi muốn có khả năng hoạt động offline.
 *
 * Luồng xử lý:
 *   1. Sinh `temp_id` (UUID v4) + `local_created_at` NGAY LẬP TỨC.
 *   2. Nếu `navigator.onLine === true`: thử gọi RPC `sync_offline_order` luôn.
 *      - Thành công -> xong, KHÔNG ghi vào IndexedDB (đơn đã nằm trên server).
 *      - Thất bại (timeout, đứt mạng giữa chừng dù trình duyệt chưa kịp báo
 *        offline, lỗi 5xx tạm thời...) -> rơi xuống bước 3 như đang offline.
 *   3. Nếu offline (hoặc bước 2 thất bại): ghi vào `localDb.orders` với
 *      `sync_status: 'pending'` — SyncManager (components/SyncManager.tsx) sẽ
 *      tự đồng bộ lại khi có mạng.
 *
 * CHỦ Ý KHÔNG throw lỗi ra ngoài ở bước 3 (trừ khi chính việc ghi IndexedDB
 * thất bại — vd trình duyệt chặn hẳn IndexedDB) — mất mạng KHÔNG được coi là
 * lỗi cần chặn UI, đó chính là lý do tồn tại của tính năng này.
 */
export function useOfflineOrder() {
  const submitOrder = useCallback(async (orderPayload: OfflineOrderPayload): Promise<SubmitOrderResult> => {
    const temp_id = crypto.randomUUID();
    const local_created_at = new Date().toISOString();
    const isOnline = typeof window !== "undefined" ? window.navigator.onLine : false;

    if (isOnline) {
      try {
        const ok = await tryRpcSync(temp_id, orderPayload);
        if (ok) {
          return { temp_id, synced: true };
        }
      } catch {
        // Lỗi mạng ngầm (mất kết nối/timeout giữa chừng dù navigator.onLine
        // vẫn báo true) -> tiếp tục rơi xuống luồng offline bên dưới thay vì
        // ném lỗi cho UI, đúng tinh thần "độ trễ 0ms" của tính năng này.
      }
    }

    const localOrder: LocalOrder = {
      temp_id,
      table_id: orderPayload.table_id,
      staff_id: orderPayload.staff_id,
      items: orderPayload.items,
      sync_status: "pending",
      local_created_at,
    };

    if (typeof window !== "undefined") {
      await localDb.orders.add(localOrder);
    }

    return { temp_id, synced: false };
  }, []);

  return { submitOrder };
}
