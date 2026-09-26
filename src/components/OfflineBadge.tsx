"use client";

import { Badge } from "@/components/ui/badge";
import { localDb } from "@/lib/db";
import { useEffect, useState } from "react";

/** Tần suất đọc lại số đơn `pending` từ IndexedDB để cập nhật badge — KHÔNG cần realtime tuyệt đối, chỉ cần đủ nhanh để nhân viên thấy số liệu gần đúng. */
const PENDING_COUNT_POLL_MS = 5_000;

/**
 * Module 21 — Offline-First (Giai đoạn 1): hiển thị trạng thái kết nối +
 * số đơn chưa đồng bộ trên thanh Header/Navbar (mount ở StaffNav.tsx — xem
 * ghi chú JSDoc ở đó về lý do đặt tại đây thay vì AdminNav).
 *
 * 3 phần độc lập:
 *   1. Chấm 🟢/🟠 theo `navigator.onLine` — cập nhật qua sự kiện
 *      `online`/`offline` của trình duyệt (tức thời, không cần polling).
 *   2. Badge "⚠️ Còn X đơn chưa đồng bộ" — chỉ hiện khi còn đơn `pending`
 *      trong IndexedDB, số liệu lấy qua polling mỗi
 *      `PENDING_COUNT_POLL_MS` (IndexedDB không có cơ chế "subscribe" native
 *      nên không thể cập nhật tức thời như (1) mà không kéo thêm thư viện
 *      ngoài đặc tả gốc, vd `dexie-react-hooks`).
 *   3. Cảnh báo `beforeunload` nếu còn đơn `pending` lúc nhân viên định đóng
 *      tab/trình duyệt — tránh mất đơn đang chờ đồng bộ vì đóng tab quá sớm.
 */
export function OfflineBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // (1) Trạng thái online/offline — tức thời qua sự kiện trình duyệt.
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(window.navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // (2) Số đơn pending — polling định kỳ từ IndexedDB.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function refreshPendingCount() {
      const count = await localDb.orders.where("sync_status").equals("pending").count();
      if (!cancelled) setPendingCount(count);
    }

    void refreshPendingCount();
    const intervalId = window.setInterval(() => void refreshPendingCount(), PENDING_COUNT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // (3) Cảnh báo đóng tab khi còn đơn pending.
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingCount === 0) return;
      // Cú pháp bắt buộc để trình duyệt hiện hộp thoại xác nhận rời trang —
      // nội dung `returnValue` thực tế không hiển thị (mọi trình duyệt hiện
      // đại tự thay bằng thông báo mặc định của chính nó, không cho tuỳ biến).
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingCount]);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-hidden="true"
        />
        {isOnline ? "🟢 Trực tuyến" : "🟠 Ngoại tuyến (Đang lưu đệm)"}
      </span>
      {pendingCount > 0 && <Badge variant="warning">⚠️ Còn {pendingCount} đơn chưa đồng bộ</Badge>}
    </div>
  );
}
