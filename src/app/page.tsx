import { redirect } from "next/navigation";

interface HomePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/**
 * Trang gốc chỉ đóng vai trò điều hướng: URL trên mã QR dán tại bàn trỏ về
 * "/" kèm `?table=X`, ta chuyển tiếp nguyên query sang /order để TableProvider xử lý.
 */
export default function HomePage({ searchParams }: HomePageProps) {
  const table = searchParams.table;
  redirect(table ? `/order?table=${table}` : "/order");
}
