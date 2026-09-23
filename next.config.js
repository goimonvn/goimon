/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Ảnh món ăn lưu trên Supabase Storage.
      { protocol: "https", hostname: "*.supabase.co" },
      // Ảnh QR VietQR để hiển thị màn hình thanh toán chuyển khoản.
      { protocol: "https", hostname: "img.vietqr.io" },
    ],
  },
};

module.exports = nextConfig;
