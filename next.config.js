/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Ảnh món ăn lưu trên Supabase Storage.
      { protocol: "https", hostname: "*.supabase.co" },
      // Ảnh QR VietQR để hiển thị màn hình thanh toán chuyển khoản (thủ công).
      { protocol: "https", hostname: "img.vietqr.io" },
      // Ảnh QR động do PayOS trả về (payos.service.ts buildQrImageUrl) — dùng
      // để hiển thị mã VietQR tự động xác nhận qua Webhook (Module 15).
      { protocol: "https", hostname: "api.qrserver.com" },
    ],
  },
};

module.exports = nextConfig;
