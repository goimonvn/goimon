// BOM (Byte Order Mark) UTF-8 — thiếu ký tự này, Excel trên Windows (mặc định
// của đa số quán) sẽ mở sai tiếng Việt có dấu khi mở trực tiếp file .csv.
const CSV_BOM = "﻿";

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Ghép nhiều dòng (mỗi dòng là 1 mảng giá trị) thành nội dung CSV hoàn chỉnh.
 * Cho phép dòng trống (`[]`) để tạo khoảng cách giữa các phần trong file —
 * dùng ở trang `/admin/analytics` để xuất nhiều bảng số liệu khác nhau
 * (chỉ số tổng hợp, doanh thu theo thứ, top món) trong CÙNG 1 file CSV.
 */
export function buildCsv(rows: (string | number)[][]): string {
  return CSV_BOM + rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

/** Tải file CSV về máy qua Blob + thẻ `<a>` ẩn — không cần thêm thư viện ngoài. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
