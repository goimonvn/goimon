import { supabase } from "@/lib/supabase/client";
import { AppError, type VatInvoiceInput, type VatInvoiceWithOrder } from "@/types";
import type { VatInvoicesRow } from "@/types/database.types";

export async function createVatInvoice(
  orderId: string,
  input: VatInvoiceInput
): Promise<void> {
  const { error } = await supabase.from("vat_invoices").insert({
    order_id: orderId,
    company_name: input.companyName,
    tax_code: input.taxCode,
    address: input.address,
    email: input.email,
  });

  if (error) {
    throw new AppError("Không thể lưu thông tin xuất hoá đơn VAT.", error);
  }
}

/**
 * Hoá đơn VAT (nếu có) của một đơn — dùng khi in tạm tính trực tiếp (Module 5)
 * để gộp thông tin công ty/MST vào bill nhiệt. LƯU Ý: RLS chỉ cho phép role
 * 'admin' đọc vat_invoices (xem schema.sql) — nếu người in là nhân viên
 * thường, câu query này sẽ không trả về gì (không lỗi), bill in ra sẽ THIẾU
 * phần VAT dù đơn có yêu cầu xuất hoá đơn; đây là đánh đổi chấp nhận được
 * theo đúng phân quyền đã thiết lập từ Module 4, không phải lỗi.
 */
export async function getVatInvoiceForOrder(
  orderId: string
): Promise<{ companyName: string; taxCode: string } | null> {
  const { data, error } = await supabase
    .from("vat_invoices")
    .select("company_name, tax_code")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return { companyName: data.company_name, taxCode: data.tax_code };
}

/** Danh sách toàn bộ hoá đơn VAT đã xuất, kèm tổng tiền + số bàn của đơn gốc — dùng cho trang chủ quán. */
export async function getAllVatInvoices(): Promise<VatInvoiceWithOrder[]> {
  const { data, error } = await supabase
    .from("vat_invoices")
    .select("*, order:orders(id, total_amount, created_at, table:tables(table_number))")
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Không thể tải danh sách hoá đơn VAT.", error);
  }

  // Xem ghi chú ở order.service.ts về việc ép kiểu tường minh cho trường embed
  // khi Database type viết tay không có metadata Relationships.
  type RawRow = VatInvoicesRow & {
    order: { id: string; total_amount: number; created_at: string; table: { table_number: number } | null } | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  return rows.map(({ order, ...rest }) => ({
    ...rest,
    order: order
      ? {
          id: order.id,
          total_amount: order.total_amount,
          created_at: order.created_at,
          table_number: order.table?.table_number ?? null,
        }
      : null,
  }));
}
