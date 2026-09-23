"use client";

import { useEffect, useState } from "react";

/** Trả về thời điểm hiện tại, tự cập nhật mỗi `tickMs` — dùng để tính thời gian chờ của món ăn. */
export function useNow(tickMs = 15000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return now;
}
