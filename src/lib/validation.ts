import { z } from "zod";

/**
 * Module 18 — Đặt bàn trước từ xa. Lần đầu tiên dự án dùng Zod (đã có sẵn
 * trong package.json từ đầu nhưng chưa từng dùng tới) — mọi bảng khác trong
 * dự án chỉ kiểm tra tay từng trường trước khi gọi Supabase (xem
 * ExpenseFormDialog.tsx, PromotionFormDialog.tsx...). Đặt schema riêng ở đây
 * (thay vì lẫn vào types/index.ts, vốn chỉ chứa kiểu dữ liệu THUẦN, không có
 * logic) vì đây là chỗ tự nhiên nhất cho các schema xác thực dùng Zod sau này.
 *
 * Dùng CHUNG cho cả 2 nguồn tạo lượt đặt bàn — khách tự đặt qua `/dat-ban`
 * (component ReservationForm) VÀ nhân viên tạo hộ khi khách gọi điện
 * (`ReservationFormDialog` ở `/staff/reservations`) — validate NGAY Ở CLIENT
 * trước khi gọi service để báo lỗi thân thiện tức thì. Đây KHÔNG thay thế RLS
 * ở Supabase (xem policy "Public insert reservations"/"Staff insert
 * reservations" trong schema.sql) — RLS vẫn là lớp xác thực CUỐI CÙNG, đúng
 * nguyên tắc "không tin tưởng client" xuyên suốt dự án.
 */
export const reservationFormSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên khách.")
    .max(100, "Tên khách quá dài (tối đa 100 ký tự)."),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số điện thoại.")
    .regex(/^[0-9+ ]{8,15}$/, "Số điện thoại không hợp lệ."),
  partySize: z.coerce
    .number({ invalid_type_error: "Số khách không hợp lệ." })
    .int("Số khách phải là số nguyên.")
    .min(1, "Số khách phải từ 1 trở lên.")
    .max(200, "Số khách quá lớn — vui lòng liên hệ trực tiếp để đặt số lượng lớn."),
  // Chuỗi ISO từ input[type=datetime-local]. Cho phép trễ tối đa 5 phút so với
  // thời điểm gửi (khoan dung độ trễ mạng/đồng hồ thiết bị) thay vì so sánh
  // tuyệt đối với "now" — tránh chặn nhầm 1 lượt đặt hợp lệ gửi đúng lúc.
  reservationTime: z
    .string()
    .min(1, "Vui lòng chọn ngày giờ muốn đặt bàn.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Ngày giờ không hợp lệ.",
    })
    .refine((value) => new Date(value).getTime() > Date.now() - 5 * 60 * 1000, {
      message: "Vui lòng chọn thời điểm trong tương lai.",
    }),
  note: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự.")
    .optional()
    .default(""),
});

/** Dữ liệu form đặt bàn ĐÃ qua Zod xác thực — dùng làm input cho reservation.service.ts. */
export type ReservationFormValues = z.infer<typeof reservationFormSchema>;

/**
 * Parse tiện dụng cho form: trả `{ success, data }` hoặc `{ success: false,
 * error }` với message tiếng Việt đầu tiên (đủ dùng cho toast báo lỗi, không
 * cần hiển thị lỗi theo từng field riêng ở form đơn giản này).
 */
export function parseReservationForm(
  raw: unknown
): { success: true; data: ReservationFormValues } | { success: false; error: string } {
  const result = reservationFormSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstIssue = result.error.issues[0];
  return { success: false, error: firstIssue?.message ?? "Dữ liệu không hợp lệ." };
}

/**
 * Module 19 — Đặt Mua Hàng Giao Tận Nơi Từ Xa. Validate thông tin người
 * nhận/địa chỉ ở form `/delivery` (giỏ hàng) TRƯỚC khi gọi
 * delivery.service.ts#createDeliveryOrder — cùng tinh thần "báo lỗi thân
 * thiện tức thì, RLS vẫn là lớp cuối cùng" đã áp dụng cho `reservationFormSchema`
 * ở trên (Module 18).
 */
export const deliveryFormSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên người nhận.")
    .max(100, "Tên người nhận quá dài (tối đa 100 ký tự)."),
  recipientPhone: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số điện thoại người nhận.")
    .regex(/^[0-9+ ]{8,15}$/, "Số điện thoại không hợp lệ."),
  deliveryAddress: z
    .string()
    .trim()
    .min(5, "Vui lòng nhập địa chỉ giao hàng đầy đủ.")
    .max(300, "Địa chỉ quá dài (tối đa 300 ký tự)."),
  deliveryNotes: z
    .string()
    .trim()
    .max(300, "Ghi chú giao hàng tối đa 300 ký tự.")
    .optional()
    .default(""),
});

export type DeliveryFormValues = z.infer<typeof deliveryFormSchema>;

export function parseDeliveryForm(
  raw: unknown
): { success: true; data: DeliveryFormValues } | { success: false; error: string } {
  const result = deliveryFormSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstIssue = result.error.issues[0];
  return { success: false, error: firstIssue?.message ?? "Dữ liệu không hợp lệ." };
}
