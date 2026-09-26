"use client";

import { cleanUpOldLocalOrders, localDb, requestPersistentStorage, type LocalOrder } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { useEffect } from "react";

/** Quét đơn `pending` mỗi 30 giây — ĐỘC LẬP với sự kiện `online` (bù cho trường hợp mạng "chập chờn": báo online rồi lại rớt ngay trước khi kịp sync, hoặc trình duyệt không bắn sự kiện `online` đáng tin cậy trên vài hệ điều hành). */
const SYNC_INTERVAL_MS = 30_000;

/** Đồng bộ 1 đơn cục bộ — trả về true nếu đồng bộ THÀNH CÔNG (kể cả trường hợp `was_duplicate`, vì đó vẫn là kết quả hợp lệ: đơn đã có trên server). */
async function syncOneOrder(order: LocalOrder): Promise<boolean> {
  if (order.id === undefined) return false;

  try {
    const { error } = await supabase.rpc("sync_offline_order", {
      p_temp_id: order.temp_id,
      p_table_id: order.table_id,
      p_items: order.items,
      p_staff_id: order.staff_id ?? null,
    });

    if (error) throw error;

    await localDb.orders.update(order.id, { sync_status: "synced" });
    return true;
  } catch (err) {
    // KHÔNG retry vô hạn nếu lỗi mang tính LOGIC (bàn/món không còn tồn tại,
    // ràng buộc CHECK ở server từ chối...) — đánh dấu 'failed' kèm error_log
    // để nhân viên tự kiểm tra thủ công, đúng yêu cầu đặc tả. Đơn sẽ KHÔNG
    // được vòng quét/sự kiện 'online' tiếp theo thử lại nữa vì không còn ở
    // trạng thái 'pending'.
    await localDb.orders.update(order.id, {
      sync_status: "failed",
      error_log: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Module 21 — Offline-First (Giai đoạn 1): tiến trình đồng bộ nguyên tử, quét
 * toàn bộ đơn `pending` trong IndexedDB và gửi lần lượt lên Supabase (từng
 * đơn 1, KHÔNG song song — tránh dội quá nhiều request cùng lúc ngay lúc vừa
 * có mạng trở lại, và giữ thứ tự đồng bộ theo đúng thứ tự tạo đơn).
 */
async function triggerSync(): Promise<void> {
  if (typeof window === "undefined" || !window.navigator.onLine) return;

  const pendingOrders = await localDb.orders.where("sync_status").equals("pending").toArray();
  if (pendingOrders.length === 0) return;

  let syncedAny = false;
  for (const order of pendingOrders) {
    const ok = await syncOneOrder(order);
    if (ok) syncedAny = true;
  }

  // Chỉ dọn dẹp SAU khi có ít nhất 1 đơn đồng bộ thành công trong lượt quét
  // này — tránh chạy dọn dẹp vô ích mỗi 30 giây khi không có gì thay đổi.
  if (syncedAny) {
    await cleanUpOldLocalOrders();
  }
}

/**
 * Component không hiển thị gì (`return null`) — chỉ chạy nền, nhúng 1 lần duy
 * nhất ở Root Layout (`src/app/layout.tsx`) để hoạt động xuyên suốt mọi trang.
 *
 * 2 nguồn kích hoạt đồng bộ:
 *   1. Sự kiện `online` của trình duyệt — kích hoạt NGAY khi mạng vừa có lại.
 *   2. `setInterval` mỗi 30 giây — quét định kỳ, phòng trường hợp (1) không
 *      xảy ra hoặc mạng chập chờn (xem ghi chú SYNC_INTERVAL_MS).
 *
 * Ngoài ra còn gọi `requestPersistentStorage()` 1 lần lúc mount và chạy thử
 * `triggerSync()` ngay lập tức (phòng trường hợp đã có đơn `pending` tồn đọng
 * từ phiên trước, vd nhân viên tắt trình duyệt lúc đang mất mạng rồi mở lại
 * khi đã có mạng — không cần đợi tới sự kiện `online` hay đủ 30 giây).
 */
export function SyncManager(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    void requestPersistentStorage();
    void triggerSync();

    function handleOnline() {
      void triggerSync();
    }
    window.addEventListener("online", handleOnline);

    const intervalId = window.setInterval(() => void triggerSync(), SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
