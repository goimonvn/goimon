import { DEFAULT_PRINTER_SETTINGS, type PrinterSettings } from "@/types";

const STORAGE_KEY = "goimon_printer_settings";

/**
 * Cấu hình máy in nhiệt lưu localStorage — xem giải thích lý do KHÔNG lưu
 * Supabase ở JSDoc của `PrinterSettings` (src/types/index.ts). Mọi lỗi đọc/ghi
 * (chế độ ẩn danh khắt khe, dữ liệu cũ hỏng...) đều rơi về mặc định thay vì
 * làm crash màn hình thu ngân.
 */
export function getPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    return { ...DEFAULT_PRINTER_SETTINGS, ...(JSON.parse(raw) as Partial<PrinterSettings>) };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Bỏ qua lỗi lưu trữ cục bộ — nhân viên vẫn có thể dùng lại nút "In tạm tính" (popup) như cũ.
  }
}
