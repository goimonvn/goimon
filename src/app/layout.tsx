import { SyncManager } from "@/components/SyncManager";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gọi Món",
  description: "Đặt món trực tuyến ngay tại bàn",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3f00",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-muted/30 antialiased">
        {children}
        <Toaster richColors position="top-center" />
        {/* Module 21 — Offline-First (Giai đoạn 1): chạy nền xuyên suốt mọi
            trang, không hiển thị gì (xem JSDoc trong SyncManager.tsx). */}
        <SyncManager />
      </body>
    </html>
  );
}
