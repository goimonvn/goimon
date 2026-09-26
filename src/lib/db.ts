import Dexie, { type Table } from "dexie";

/**
 * Module 21 — Offline-First (Giai đoạn 1): bộ nhớ đệm cục bộ (IndexedDB, qua
 * Dexie) cho đơn hàng được tạo lúc mất mạng. Xem thêm ghi chú "Zero Trust" ở
 * `sync_offline_order` (schema.sql) và hooks/useOfflineOrder.ts.
 *
 * 1 dòng LocalOrder = 1 đơn đang chờ (hoặc đã) đồng bộ lên Supabase:
 *   - 'pending': chưa gửi lên được (đang offline, hoặc online nhưng lần gửi
 *     đầu thất bại) — CHỜ SyncManager thử lại.
 *   - 'synced': đã đồng bộ thành công — chỉ giữ lại để nhân viên xem lịch sử
 *     gần đây, sẽ bị `cleanUpOldLocalOrders()` dọn dần theo thời gian/dung lượng.
 *   - 'failed': đã thử đồng bộ nhưng Supabase từ chối vì LỖI LOGIC (vd bàn/món
 *     không còn tồn tại) — KHÔNG tự retry nữa, giữ nguyên kèm `error_log` để
 *     nhân viên tự kiểm tra thủ công.
 */
export interface LocalOrder {
  id?: number;
  /** UUID v4 do client tự sinh (crypto.randomUUID()) — dùng làm Idempotency Key khi gọi RPC sync_offline_order. */
  temp_id: string;
  table_id: string;
  staff_id?: string;
  items: Array<{ menu_item_id: string; quantity: number; note?: string }>;
  sync_status: "pending" | "synced" | "failed";
  local_created_at: string;
  error_log?: string;
}

class GoimonLocalDB extends Dexie {
  orders!: Table<LocalOrder, number>;

  constructor() {
    super("GoimonLocalDB");
    // LƯU Ý: đặc tả gốc ghi chỉ mục là "++id, temp_id, sync_status,
    // created_at", nhưng field thật sự trong LocalOrder là `local_created_at`
    // (không phải `created_at`) — đã sửa lại tên cột trong chỉ mục cho khớp
    // đúng field thật, nếu không Dexie sẽ tạo chỉ mục trên 1 field không tồn
    // tại và mọi query sắp xếp/lọc theo thời gian phía dưới sẽ luôn rỗng.
    this.version(1).stores({
      orders: "++id, temp_id, sync_status, local_created_at",
    });
  }
}

/** Instance dùng chung toàn app — Dexie tự lười khởi tạo kết nối IndexedDB thật sự tới khi có query đầu tiên, nên import ở Server Component không gây lỗi SSR (chỉ TRUY CẬP field/method của nó mới cần guard `typeof window`, xem các hàm bên dưới). */
export const localDb = new GoimonLocalDB();

/**
 * Đăng ký với trình duyệt để KHÔNG tự động "evict" (xoá sạch) IndexedDB của
 * Goimon khi thiết bị gần hết dung lượng đĩa — quan trọng vì đây là nơi giữ
 * các đơn `pending` CHƯA kịp đồng bộ, mất là mất luôn đơn của khách. Chỉ là
 * một LỜI ĐỀ NGHỊ gửi trình duyệt (không phải lệnh bắt buộc) — trình duyệt có
 * thể vẫn từ chối tuỳ chính sách nội bộ, nên hàm này không throw khi bị từ
 * chối, chỉ trả về true/false để caller tự quyết định có cần cảnh báo hay không.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("storage" in navigator) || typeof navigator.storage.persist !== "function") return false;

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Số đơn `synced` tối đa được giữ lại trong IndexedDB — vượt quá sẽ xoá bớt đơn cũ nhất (xem Quy tắc 2 ở cleanUpOldLocalOrders). */
const MAX_SYNCED_ORDERS = 300;

/** Số ngày giữ lại 1 đơn `synced` trước khi bị dọn tự động (xem Quy tắc 1 ở cleanUpOldLocalOrders). */
const SYNCED_RETENTION_DAYS = 3;

/**
 * Chiến lược tự động dọn dẹp IndexedDB — gọi sau mỗi lần SyncManager đồng bộ
 * thành công (xem components/SyncManager.tsx), KHÔNG chạy theo lịch riêng, để
 * tránh dọn dẹp chạy song song với chính lúc đang ghi dữ liệu mới.
 *
 * Quy tắc 1 (theo thời gian): xoá mọi đơn `sync_status === 'synced'` đã lưu
 * quá `SYNCED_RETENTION_DAYS` ngày (tính theo `local_created_at`, thời điểm
 * TẠO đơn ở client — không phải lúc đồng bộ xong).
 *
 * Quy tắc 2 (theo dung lượng): nếu số đơn `synced` còn lại VẪN vượt quá
 * `MAX_SYNCED_ORDERS` (vd quán đông, tạo rất nhiều đơn trong ngày, chưa tới 3
 * ngày nhưng đã quá 300), xoá bớt các đơn `synced` CŨ NHẤT cho tới khi vừa đủ
 * `MAX_SYNCED_ORDERS`.
 *
 * KHÔNG BAO GIỜ đụng tới đơn `pending` (đang chờ đồng bộ) — dù có cũ tới đâu.
 * Đơn `failed` cũng KHÔNG bị 2 quy tắc trên dọn (đặc tả gốc chỉ nhắm tới đơn
 * `synced`) — nhân viên cần tự thấy đơn lỗi để xử lý thủ công, dọn quá sớm sẽ
 * mất dấu vết đơn bị từ chối.
 */
export async function cleanUpOldLocalOrders(): Promise<void> {
  if (typeof window === "undefined") return;

  const cutoffIso = new Date(Date.now() - SYNCED_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Quy tắc 1 — theo thời gian.
  await localDb.orders
    .where("sync_status")
    .equals("synced")
    .and((order) => order.local_created_at < cutoffIso)
    .delete();

  // Quy tắc 2 — theo dung lượng (chạy SAU quy tắc 1, trên phần còn sót lại).
  const remainingSynced = await localDb.orders
    .where("sync_status")
    .equals("synced")
    .sortBy("local_created_at");

  if (remainingSynced.length > MAX_SYNCED_ORDERS) {
    const idsToDelete = remainingSynced
      .slice(0, remainingSynced.length - MAX_SYNCED_ORDERS)
      .map((order) => order.id)
      .filter((id): id is number => id !== undefined);

    if (idsToDelete.length > 0) {
      await localDb.orders.bulkDelete(idsToDelete);
    }
  }
}
