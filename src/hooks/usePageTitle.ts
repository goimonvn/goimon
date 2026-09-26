"use client";

import { useEffect } from "react";

const SITE_NAME = "Gọi Món";

/**
 * Đặt tiêu đề tab trình duyệt riêng cho từng trang — dạng "<tên trang> - Gọi
 * Món". Toàn bộ trang trong dự án đều là Client Component (`"use client"`)
 * nên KHÔNG dùng được `export const metadata` của Next.js (chỉ áp dụng được
 * cho Server Component) — root layout (`src/app/layout.tsx`) chỉ đặt được 1
 * tiêu đề tĩnh dùng chung cho mọi trang. Hook này set lại `document.title`
 * ngay khi trang mount, ghi đè tiêu đề tĩnh đó bằng tiêu đề riêng của trang.
 *
 * Gọi ngay ở đầu component trang (cùng chỗ với các hook khác) — thứ tự gọi so
 * với các hook khác không quan trọng vì hook này luôn được gọi vô điều kiện.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} - ${SITE_NAME}`;
  }, [title]);
}
