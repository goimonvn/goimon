import { supabase } from "@/lib/supabase/client";
import {
  AppError,
  type CartLine,
  type DeliveryOrderInput,
  type DeliveryOrderResult,
  type DeliveryTrackingInfo,
  type OrderItemWithMenu,
  type OrderWithItems,
} from "@/types";
import type { DeliveryConfigValue, DeliveryStatus, OrdersRow } from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { notifyNewDeliveryOrderTelegram } from "./telegram.service";

const MENU_ITEM_EMBED = "id, name, image_url, price" as const;

/** Key duy nhất của dòng cấu hình giao hàng trong bảng key/value `system_settings` (Module 17, mở rộng Module 19). */
const DELIVERY_CONFIG_KEY = "delivery_config";

/**
 * Mặc định AN TOÀN NHẤT khi vì lý do gì đó chưa đọc được dòng cấu hình thật
 * (vd quên chạy lại schema.sql sau khi kéo code mới) — GIỮ NGUYÊN hành vi mặc
 * định của quán (bật giao hàng + COD, phí ship 15.000đ, freeship từ
 * 150.000đ) — cùng triết lý fail-open đã áp dụng cho `DEFAULT_PAYMENT_CONFIG`
 * (Module 17) và `getShopSettings` (Module 6): 1 cấu hình đọc lỗi không được
 * phép làm khách KHÔNG CÒN cách nào đặt hàng giao tận nơi.
 */
const DEFAULT_DELIVERY_CONFIG: DeliveryConfigValue = {
  enable_delivery: true,
  enable_cod: true,
  base_shipping_fee: 15000,
  free_shipping_threshold: 150000,
  max_delivery_distance_km: 10,
};

/** Đọc cấu hình giao hàng — dùng ở cả khách (`/delivery`, anon, qua policy "Public read system_settings" đã có từ Module 17) lẫn chủ quán (`/admin/settings`). */
export async function getDeliverySettings(): Promise<DeliveryConfigValue> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", DELIVERY_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể tải cấu hình giao hàng.", error);
  }

  // Xem ghi chú tương tự ở settings.service.ts#getPaymentSettings: `value` là
  // union kiểu (PaymentConfigValue | DeliveryConfigValue) từ Module 19, ép
  // kiểu tường minh về đúng hình dạng của key đang đọc ở đây trước khi spread.
  return { ...DEFAULT_DELIVERY_CONFIG, ...((data?.value as Partial<DeliveryConfigValue>) ?? {}) };
}

/** Chỉ admin gọi được (policy "Admin update system_settings" đã có từ Module 17, áp dụng cho mọi key) — ghi đè TOÀN BỘ giá trị JSONB bằng object mới. */
export async function updateDeliverySettings(value: DeliveryConfigValue): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", DELIVERY_CONFIG_KEY);

  if (error) {
    throw new AppError("Không thể cập nhật cấu hình giao hàng.", error);
  }
}

/** Realtime — khách đang xem `/delivery` hoặc nhân viên `/staff/orders` tự thấy đúng cấu hình mới ngay khi admin đổi ở `/admin/settings`. */
export function subscribeToDeliverySettingsChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:system_settings:delivery_config")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "system_settings", filter: `key=eq.${DELIVERY_CONFIG_KEY}` },
      () => onChange()
    )
    .subscribe();
}

/**
 * Tính phí ship — luật ĐƠN GIẢN NHẤT khớp đúng yêu cầu ban đầu: đơn hàng có
 * tổng tiền MÓN (subtotal, CHƯA gồm ship) từ `free_shipping_threshold` trở
 * lên thì miễn phí ship, ngược lại thu đúng `base_shipping_fee` cố định. CỐ Ý
 * KHÔNG tính theo khoảng cách thực (chưa có bước nhập/geocode toạ độ khách ở
 * lần triển khai này — `max_delivery_distance_km` trong cấu hình hiện chỉ là
 * ngưỡng THAM KHẢO hiển thị cho chủ quán, xem DeliveryConfigValue).
 */
export async function calculateShippingFee(subtotal: number): Promise<number> {
  const config = await getDeliverySettings();
  if (subtotal >= config.free_shipping_threshold) return 0;
  return config.base_shipping_fee;
}

function buildNoteWithOptions(line: CartLine): string {
  const optionText =
    line.selectedOptions.length > 0
      ? `Topping: ${line.selectedOptions.map((o) => o.option_name).join(", ")}`
      : "";
  return [optionText, line.note.trim()].filter(Boolean).join(" | ");
}

/**
 * Tạo 1 đơn giao hàng (Module 19) — cùng khuôn mẫu "insert order rồi insert
 * order_items, huỷ order nếu bước 2 lỗi" đã dùng ở order.service.ts#createOrder,
 * viết THÀNH HÀM RIÊNG (không mở rộng `createOrder`) vì input/luồng khác đáng
 * kể: không table_id/promotion/customerId, CÓ BẮT BUỘC người nhận + địa chỉ +
 * chọn payment_method NGAY lúc gửi đơn.
 *
 * `total_amount` lưu = TIỀN MÓN (subtotal), KHÔNG cộng phí ship — `shipping_fee`
 * lưu ở cột riêng — để mọi báo cáo doanh thu theo `total_amount` sẵn có
 * (Dashboard/Thống kê, Module 3/10) không bị lệch bởi phí ship (vốn không
 * phải doanh thu bán hàng thực). Nơi cần TỔNG THỰC THU (hiển thị cho khách,
 * thu tiền COD) luôn phải tự cộng `shipping_fee` — xem `grandTotal` ở kết quả
 * trả về và DeliveryTrackingInfo.
 *
 * COD: bắn Telegram NGAY (đơn coi như đã "chốt" — khách xác nhận địa chỉ,
 * quán chỉ chờ thu tiền lúc giao). PayOS ('vietqr'): CHƯA bắn Telegram ở đây
 * — đợi webhook PayOS xác nhận đã có tiền mới bắn (server-to-server, xem
 * `/api/webhooks/payos/route.ts`), tránh báo "đơn ship mới" cho 1 đơn khách
 * bỏ ngang chưa từng thanh toán.
 */
export async function createDeliveryOrder(input: DeliveryOrderInput): Promise<DeliveryOrderResult> {
  if (input.lines.length === 0) {
    throw new AppError("Giỏ hàng đang trống, vui lòng chọn món trước khi gửi.");
  }
  if (!input.recipientName.trim() || !input.recipientPhone.trim() || !input.deliveryAddress.trim()) {
    throw new AppError("Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ người nhận.");
  }

  const subtotal = input.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingFee = await calculateShippingFee(subtotal);

  const { data: rawOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_id: null,
      total_amount: subtotal,
      shipping_fee: shippingFee,
      payment_method: input.paymentMethod === "cod" ? "cod" : null,
      order_type: "delivery",
      recipient_name: input.recipientName.trim(),
      recipient_phone: input.recipientPhone.trim(),
      delivery_address: input.deliveryAddress.trim(),
      delivery_notes: input.deliveryNotes?.trim() || null,
    })
    .select("*")
    .single();

  if (orderError || !rawOrder) {
    throw new AppError("Không thể tạo đơn giao hàng. Vui lòng thử lại.", orderError);
  }

  const orderItemsPayload = input.lines.map((line) => ({
    order_id: rawOrder.id,
    menu_item_id: line.menuItem.id,
    quantity: line.quantity,
    notes: buildNoteWithOptions(line) || null,
    station_type: line.stationType,
    combo_id: line.comboId ?? null,
    combo_group_id: line.comboGroupId ?? null,
    combo_name: line.comboName ?? null,
  }));

  const { error: orderItemsError } = await supabase.from("order_items").insert(orderItemsPayload);

  if (orderItemsError) {
    await supabase.from("orders").delete().eq("id", rawOrder.id);
    throw new AppError("Không thể lưu các món trong đơn. Vui lòng thử lại.", orderItemsError);
  }

  if (input.paymentMethod === "cod") {
    const telegramItems = input.lines.map((line) => ({ name: line.menuItem.name, quantity: line.quantity }));
    notifyNewDeliveryOrderTelegram(
      input.recipientName.trim(),
      input.recipientPhone.trim(),
      input.deliveryAddress.trim(),
      input.deliveryNotes?.trim() || null,
      telegramItems,
      subtotal,
      shippingFee
    );
  }

  return {
    orderId: rawOrder.id,
    itemsTotal: subtotal,
    shippingFee,
    grandTotal: subtotal + shippingFee,
    paymentMethod: input.paymentMethod,
  };
}

/**
 * Chuyển bước vòng đời giao hàng (Module 19) — nhân viên bấm ở `/staff/orders`:
 * 'pending' -> 'preparing' -> 'delivering' -> 'completed'. CỐ Ý KHÔNG đụng
 * `orders.status` (xem giải thích "TÁCH delivery_status" ở schema.sql Module
 * 19) — đó vẫn là tín hiệu riêng cho bếp/KDS.
 *
 * ĐƠN COD chỉ thực sự "có tiền" lúc giao xong: khi chuyển sang 'completed' VÀ
 * `payment_method = 'cod'`, tự động đánh dấu `payment_status = 'paid'` trong
 * CÙNG câu UPDATE này (giống tinh thần `markOrdersPaid`, "tiền đã thu là sự
 * thật quan trọng nhất") — đơn PayOS ('vietqr') đã 'paid' từ trước (webhook),
 * không cần đụng lại.
 */
export async function updateDeliveryStatus(orderId: string, status: DeliveryStatus): Promise<void> {
  const payload: Record<string, unknown> = { delivery_status: status };
  if (status === "completed") {
    // Xem ghi chú ở order.service.ts#fetchActiveOrdersWithItems: `.select()`
    // cột hẹp trên client viết tay không suy luận chính xác kiểu, ép kiểu
    // tường minh qua `unknown` ngay sau khi lấy `data` về.
    const { data: orderData } = await supabase
      .from("orders")
      .select("payment_method, payment_status")
      .eq("id", orderId)
      .maybeSingle();
    const order = orderData as unknown as Pick<OrdersRow, "payment_method" | "payment_status"> | null;
    if (order?.payment_method === "cod" && order.payment_status === "unpaid") {
      payload.payment_status = "paid";
      payload.paid_at = new Date().toISOString();
    }
  }

  const { error } = await supabase.from("orders").update(payload).eq("id", orderId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái giao hàng.", error);
  }
}

async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new AppError("Không thể tải thông tin đơn hàng.", orderError);
  }
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(`*, menu_item:menu_items(${MENU_ITEM_EMBED})`)
    .eq("order_id", orderId);

  if (itemsError) {
    throw new AppError("Không thể tải danh sách món trong đơn.", itemsError);
  }

  return {
    ...order,
    order_items: (items ?? []) as unknown as OrderItemWithMenu[],
  };
}

/** Dữ liệu cho `/delivery/track/[id]` — order + order_items + `grandTotal` đã cộng sẵn phí ship, tránh trang phải tự tính lại. */
export async function getDeliveryTrackingInfo(orderId: string): Promise<DeliveryTrackingInfo | null> {
  const order = await fetchOrderWithItems(orderId);
  if (!order) return null;
  return { order, grandTotal: order.total_amount + order.shipping_fee };
}

/** Toàn bộ đơn giao hàng CHƯA kết thúc (khác completed/cancelled) — dùng cho `/staff/orders`. */
export async function getActiveDeliveryOrders(): Promise<OrderWithItems[]> {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_type", "delivery")
    .neq("delivery_status", "completed")
    .neq("delivery_status", "cancelled")
    .order("created_at", { ascending: true });

  if (ordersError) {
    throw new AppError("Không thể tải danh sách đơn giao hàng.", ordersError);
  }
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(`*, menu_item:menu_items(${MENU_ITEM_EMBED})`)
    .in("order_id", orderIds);

  if (itemsError) {
    throw new AppError("Không thể tải danh sách món trong đơn.", itemsError);
  }

  const typedItems = (items ?? []) as unknown as OrderItemWithMenu[];

  return orders.map((order) => ({
    ...order,
    order_items: typedItems.filter((item) => item.order_id === order.id),
  }));
}

/** Lắng nghe realtime mọi thay đổi trên đơn giao hàng — dùng để làm mới danh sách của nhân viên (`/staff/orders`). Xem ghi chú "AN TOÀN GỌI LẶP"/dual-path ở order.service.ts về lý do luôn kèm polling ở phía UI cần độ tin cậy cao (tracking khách). */
export function subscribeToDeliveryOrderChanges(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:orders:delivery")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => onChange())
    .subscribe();
}

/** Lắng nghe realtime đúng 1 đơn giao hàng — dùng cho `/delivery/track/[id]` (đường "NHANH", luôn kèm polling ở trang đó làm đường "CHẮC CHẮN", xem ghi chú order.service.ts#getOrderPaymentStatus về bug Supabase Realtime đã biết). */
export function subscribeToOneOrderChanges(orderId: string, onUpdate: () => void): RealtimeChannel {
  return supabase
    .channel(`public:orders:id=${orderId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
      () => onUpdate()
    )
    .subscribe();
}
