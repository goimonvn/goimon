import { supabase } from "@/lib/supabase/client";
import { calculatePointsEarned } from "@/lib/loyalty";
import {
  AppError,
  type CartLine,
  type CreateOrderInput,
  type InventoryDeductionResult,
  type KdsTicket,
  type OrderItemWithMenu,
  type OrderWithItems,
} from "@/types";
import type {
  OrderItemStatus,
  OrdersRow,
  PaymentMethod,
  StationType,
} from "@/types/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { checkAndDeductInventoryForOrderItem } from "./inventory.service";
import { awardLoyaltyPoints } from "./loyalty.service";
import { redeemPromotion, releasePromotionUsage } from "./promotion.service";
import { getActiveShiftForCurrentStaff } from "./shift.service";
import { notifyNewOrderTelegram } from "./telegram.service";
import { updateTableStatus } from "./table.service";

const MENU_ITEM_EMBED = "id, name, image_url, price" as const;

function buildNoteWithOptions(line: CartLine): string {
  const optionText =
    line.selectedOptions.length > 0
      ? `Topping: ${line.selectedOptions.map((o) => o.option_name).join(", ")}`
      : "";
  return [optionText, line.note.trim()].filter(Boolean).join(" | ");
}

/** Hoàn lượt dùng khuyến mãi (hành động BÙ TRỪ khi tạo đơn thất bại) — lỗi ở bước này không được che lấp lỗi gốc đã khiến đơn thất bại. */
async function releasePromotionUsageSafely(promotionId: string): Promise<void> {
  try {
    await releasePromotionUsage(promotionId);
  } catch {
    // Bỏ qua: xem giải thích ở JSDoc hàm gọi. Lượt dùng có thể lệch nhẹ trong
    // trường hợp hiếm này, chấp nhận được — không được phép ném lỗi thay lỗi gốc.
  }
}

/**
 * Tạo order + order_items trong một luồng: insert order trước để lấy order_id,
 * sau đó insert toàn bộ order_items. Nếu bước 2 lỗi, cố gắng huỷ order vừa tạo
 * để không để lại đơn "ma" — Supabase JS không hỗ trợ transaction đa bảng nên
 * đây là cách an toàn nhất ở tầng client.
 *
 * ÁP DỤNG KHUYẾN MÃI (Module 9): nếu có `input.promotionId`, redeem TRƯỚC KHI
 * insert order (qua RPC nguyên tử `redeem_promotion`) để `total_amount` đã
 * đúng giá đã giảm ngay từ đầu — không cần sửa lại đơn sau khi tạo. Nếu mã
 * KHÔNG còn hợp lệ tại đúng thời điểm gửi đơn (vừa hết lượt/hết hạn giữa lúc
 * khách xem giỏ hàng và lúc bấm gửi), KHÔNG chặn việc gửi đơn — chỉ bỏ qua
 * giảm giá và báo lại cho caller qua `discountApplied` để hiển thị thông báo
 * phù hợp, đúng tinh thần "đừng để lỗi phụ làm hỏng luồng chính" xuyên suốt
 * dự án. Nếu redeem thành công nhưng bước insert order/order_items sau đó lại
 * lỗi, hoàn lại lượt dùng vừa redeem (`releasePromotionUsage`) để không lãng
 * phí lượt của khách cho một đơn không thành.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<{ order: OrderWithItems; discountApplied: boolean }> {
  if (input.lines.length === 0) {
    throw new AppError("Giỏ hàng đang trống, vui lòng chọn món trước khi gửi.");
  }

  const subtotal = input.lines.reduce((sum, line) => sum + line.lineTotal, 0);

  let discountAmount = 0;
  let promotionId: string | null = null;
  if (input.promotionId) {
    try {
      discountAmount = await redeemPromotion(input.promotionId, subtotal);
      promotionId = input.promotionId;
    } catch {
      // Bỏ qua: xem giải thích ở JSDoc hàm này — đơn vẫn được gửi theo giá gốc.
    }
  }
  const discountApplied = promotionId !== null;
  const totalAmount = subtotal - discountAmount;

  const { data: rawOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_id: input.tableId,
      total_amount: totalAmount,
      payment_method: null,
      customer_id: input.customerId ?? null,
      promotion_id: promotionId,
      discount_amount: discountAmount,
    })
    // Kèm luôn table_number trong CÙNG round-trip (không query thêm) — chỉ
    // dùng để bắn thông báo Telegram bên dưới (Module 7), không phải dữ liệu
    // nghiệp vụ của order nên tách khỏi biến `order` trả về ngay sau đây.
    .select("*, table:tables(table_number)")
    .single();

  if (orderError || !rawOrder) {
    if (promotionId) await releasePromotionUsageSafely(promotionId);
    throw new AppError("Không thể tạo đơn hàng. Vui lòng thử lại.", orderError);
  }

  // Xem ghi chú ở fetchActiveOrdersWithItems() về việc ép kiểu tường minh cho embed.
  type RawOrderRow = OrdersRow & { table: { table_number: number } | null };
  const { table, ...order } = rawOrder as unknown as RawOrderRow;

  // Module 11: dòng "nổ" ra từ combo mang thêm combo_id/combo_group_id/combo_name
  // (undefined/null cho món gọi lẻ bình thường) — xem CartContext.addComboLines.
  const orderItemsPayload = input.lines.map((line) => ({
    order_id: order.id,
    menu_item_id: line.menuItem.id,
    quantity: line.quantity,
    notes: buildNoteWithOptions(line) || null,
    station_type: line.stationType,
    combo_id: line.comboId ?? null,
    combo_group_id: line.comboGroupId ?? null,
    combo_name: line.comboName ?? null,
  }));

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .insert(orderItemsPayload)
    .select("*");

  if (orderItemsError || !orderItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    if (promotionId) await releasePromotionUsageSafely(promotionId);
    throw new AppError("Không thể lưu các món trong đơn. Vui lòng thử lại.", orderItemsError);
  }

  // Bàn chuyển sang trạng thái "đang gọi món" — không chặn luồng chính nếu lỗi nhẹ.
  try {
    await updateTableStatus(input.tableId, "ordering");
  } catch {
    // Bỏ qua: trạng thái bàn không ảnh hưởng tới việc đơn đã được ghi nhận thành công.
  }

  // Báo quán qua Telegram (Module 7) — fire-and-forget, không await, không
  // bao giờ ảnh hưởng tới việc đơn đã được tạo thành công (xem telegram.service.ts).
  if (table?.table_number) {
    notifyNewOrderTelegram(
      table.table_number,
      input.lines.map((line) => ({ name: line.menuItem.name, quantity: line.quantity })),
      subtotal
    );
  }

  return {
    order: {
      ...order,
      order_items: orderItems.map((item) => ({ ...item, menu_item: null })),
    },
    discountApplied,
  };
}

/** Tải orders (lọc theo bàn nếu có) + order_items kèm tên/giá món, gộp thành cây order -> items. */
async function fetchActiveOrdersWithItems(tableId?: string): Promise<OrderWithItems[]> {
  let query = supabase
    .from("orders")
    .select("*")
    .in("status", ["pending", "preparing"])
    .order("created_at", { ascending: true });

  if (tableId) query = query.eq("table_id", tableId);

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    throw new AppError("Không thể tải trạng thái đơn hàng.", ordersError);
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

  // Supabase JS chưa suy ra chính xác kiểu cho trường embed (menu_item) từ
  // Database type viết tay (không có metadata Relationships như CLI codegen),
  // nên ép kiểu tường minh một lần ở đây thay vì để `any` rò rỉ ra ngoài service.
  const typedItems = (items ?? []) as unknown as OrderItemWithMenu[];

  return orders.map((order) => ({
    ...order,
    order_items: typedItems.filter((item) => item.order_id === order.id),
  }));
}

/**
 * Lấy các đơn đang hoạt động (chưa completed/cancelled) của một bàn, kèm order_items
 * và tên món, dùng cho màn hình theo dõi trạng thái của khách và chi tiết bàn của nhân viên.
 */
export async function getActiveOrdersByTable(tableId: string): Promise<OrderWithItems[]> {
  return fetchActiveOrdersWithItems(tableId);
}

/** Lấy toàn bộ đơn đang hoạt động của TẤT CẢ các bàn — dùng cho lưới quản lý bàn của nhân viên. */
export async function getAllActiveOrders(): Promise<OrderWithItems[]> {
  return fetchActiveOrdersWithItems();
}

/**
 * Lấy hàng đợi món cho một trạm (bar/bếp) theo đúng thứ tự FIFO (món cũ nhất lên trước),
 * đã làm phẳng kèm số bàn + tên món để KDS render trực tiếp không cần join thêm.
 * `station_type` đã được lưu sẵn trên order_items từ lúc tạo đơn (Module 1) nên không
 * cần join qua menu_items để lọc trạm.
 */
export async function getStationQueue(station: StationType): Promise<KdsTicket[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_id, menu_item_id, quantity, notes, item_status, station_type, combo_name, created_at, menu_item:menu_items(name), order:orders(table:tables(table_number))"
    )
    .eq("station_type", station)
    .in("item_status", ["pending", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Không thể tải hàng đợi món cho trạm này.", error);
  }

  type RawRow = {
    id: string;
    order_id: string;
    menu_item_id: string;
    quantity: number;
    notes: string | null;
    item_status: OrderItemStatus;
    station_type: StationType;
    combo_name: string | null;
    created_at: string;
    menu_item: { name: string } | null;
    order: { table: { table_number: number } | null } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.id,
    order_id: row.order_id,
    menu_item_id: row.menu_item_id,
    menu_item_name: row.menu_item?.name ?? "Món",
    table_number: row.order?.table?.table_number ?? null,
    quantity: row.quantity,
    notes: row.notes,
    item_status: row.item_status,
    station_type: row.station_type,
    combo_name: row.combo_name,
    created_at: row.created_at,
  }));
}

/**
 * Cập nhật trạng thái 1 món (KDS bấm chuyển pending -> preparing -> ready -> served).
 *
 * CỐ Ý KHÔNG tự động chuyển order.status = 'completed' khi mọi món đã served:
 * "đã phục vụ hết món" không đồng nghĩa "đã hoàn tất đơn" — khách có thể gọi
 * thêm món, và bàn chỉ thực sự xong khi thanh toán được xác nhận
 * (xem markOrdersPaid). Nếu tự động completed ở đây, đơn sẽ biến mất khỏi bộ
 * lọc "đang hoạt động" (pending/preparing) dù khách chưa trả tiền — rất nguy
 * hiểm cho khâu thu ngân.
 *
 * TRỪ KHO (Module 6): khi chuyển sang 'preparing' — đúng thời điểm bếp/bar
 * "Bắt đầu làm" — tự động trừ kho theo công thức (`recipe_items`) của món đó
 * nhân với số lượng đặt. Trừ kho chạy TRƯỚC khi đổi trạng thái: nếu quán bật
 * "chặn khi thiếu kho" và không đủ nguyên liệu, hàm ném lỗi và item_status
 * KHÔNG bị đổi (nhân viên phải nhập thêm kho trước). Trả về danh sách nguyên
 * liệu thiếu (rỗng nếu đủ) để KDS hiển thị cảnh báo dù không bị chặn.
 */
export async function updateOrderItemStatus(
  itemId: string,
  status: OrderItemStatus
): Promise<InventoryDeductionResult> {
  let insufficientIngredients: string[] = [];

  if (status === "preparing") {
    const { data: item, error: itemError } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      throw new AppError("Không thể xác định món để trừ kho nguyên liệu.", itemError);
    }

    const result = await checkAndDeductInventoryForOrderItem(item.menu_item_id, item.quantity);
    insufficientIngredients = result.insufficientIngredients;
  }

  const { error } = await supabase.from("order_items").update({ item_status: status }).eq("id", itemId);

  if (error) {
    throw new AppError("Không thể cập nhật trạng thái món.", error);
  }

  return { insufficientIngredients };
}

export async function setOrderPaymentMethod(
  orderId: string,
  paymentMethod: PaymentMethod
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ payment_method: paymentMethod })
    .eq("id", orderId);

  if (error) {
    throw new AppError("Không thể cập nhật phương thức thanh toán.", error);
  }
}

/**
 * Nhân viên xác nhận đã thu tiền cho toàn bộ đơn đang hoạt động của một bàn:
 * đánh dấu payment_status = 'paid', status = 'completed' cho các đơn đó, rồi
 * trả bàn về 'empty' để sẵn sàng đón khách mới.
 *
 * GẮN CA LÀM VIỆC (Module 8): nếu nhân viên đang có ca mở, `shift_id` của các
 * đơn này được set NGAY TRONG CÙNG câu UPDATE ở trên (policy "Staff confirm
 * payment" đã cho phép sửa mọi cột trên orders, không cần policy RLS mới).
 * CỐ Ý KHÔNG chặn việc xác nhận thanh toán nếu nhân viên quên "Bắt đầu ca" —
 * `shift_id` khi đó chỉ đơn giản là null, còn tiền vẫn được ghi nhận đầy đủ
 * ("tiền đã thu là sự thật quan trọng nhất"). Hàm trả về `shiftId` để UI hiện
 * nhắc nhở (không chặn) nếu chưa có ca đang mở.
 *
 * Sau khi chốt thanh toán thành công, TỰ ĐỘNG cộng điểm thưởng (10.000đ = 1
 * điểm — xem lib/loyalty.ts) cho từng đơn có gắn customer_id (khách đã nhập
 * SĐT ở bước giỏ hàng). Cộng điểm được thực hiện SAU khi tiền đã ghi nhận
 * chắc chắn, và lỗi cộng điểm (nếu có) CHỈ log cảnh báo chứ không được phép
 * làm rollback/báo lỗi việc xác nhận thanh toán — tiền đã thu là sự thật vận
 * hành quan trọng nhất, điểm thưởng là tiện ích cộng thêm.
 */
export async function markOrdersPaid(
  orderIds: string[],
  tableId: string,
  paymentMethod: PaymentMethod
): Promise<{ shiftId: string | null }> {
  if (orderIds.length === 0) {
    throw new AppError("Không có đơn hàng nào để xác nhận thanh toán.");
  }

  // Không chặn thanh toán nếu bước tra ca lỗi vì lý do bất kỳ — coi như chưa có ca mở.
  let activeShiftId: string | null = null;
  try {
    const activeShift = await getActiveShiftForCurrentStaff();
    activeShiftId = activeShift?.id ?? null;
  } catch {
    // Bỏ qua: xem giải thích ở JSDoc hàm này.
  }

  const { data: paidOrders, error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "completed",
      payment_method: paymentMethod,
      shift_id: activeShiftId,
    })
    .in("id", orderIds)
    .select("id, customer_id, total_amount");

  if (error) {
    throw new AppError("Không thể xác nhận thanh toán. Vui lòng thử lại.", error);
  }

  await updateTableStatus(tableId, "empty");

  // Xem ghi chú ở fetchActiveOrdersWithItems() về việc ép kiểu tường minh cho
  // kết quả .select() với danh sách cột tuỳ chọn (Database type viết tay
  // không suy luận chính xác kiểu hẹp theo chuỗi select truyền vào).
  type PaidOrderRow = Pick<OrdersRow, "id" | "customer_id" | "total_amount">;
  const ordersWithCustomer = ((paidOrders ?? []) as unknown as PaidOrderRow[]).filter(
    (order): order is PaidOrderRow & { customer_id: string } => order.customer_id !== null
  );

  await Promise.all(
    ordersWithCustomer.map(async (order) => {
      try {
        await awardLoyaltyPoints(
          order.customer_id,
          order.id,
          calculatePointsEarned(order.total_amount),
          order.total_amount
        );
      } catch {
        // Không chặn luồng thanh toán chính — xem giải thích ở JSDoc hàm này.
      }
    })
  );

  return { shiftId: activeShiftId };
}

/**
 * Đơn hoàn tất (đã thanh toán) gần nhất của một bàn — dùng để: (1) xác định
 * lúc nào chuyển màn hình khách sang form đánh giá (status page), và (2) gắn
 * order_id cho feedback vừa gửi. Chỉ lấy 1 đơn gần nhất vì schema `feedbacks`
 * thiết kế 1 đánh giá / 1 đơn (không phải 1 đánh giá / cả phiên nhiều đơn).
 */
export async function getLatestCompletedOrder(tableId: string): Promise<OrdersRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("table_id", tableId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("Không thể tải thông tin đơn hàng đã hoàn tất.", error);
  }
  return data;
}

/**
 * Lắng nghe realtime cập nhật trạng thái từng món (bếp/bar bấm Đang làm -> Hoàn thành).
 * order_items không có sẵn cột table_id để Postgres Changes filter trực tiếp
 * (chỉ có qua order_id -> orders.table_id), nên ở quy mô 15 bàn, cách đơn giản
 * và chắc chắn nhất là lắng nghe toàn bộ thay đổi trên bảng rồi để caller tự
 * refetch đúng dữ liệu cần — chi phí không đáng kể so với lợi ích luôn nhận
 * đủ sự kiện, tránh bug bỏ sót do stale closure trên danh sách id.
 */
export function subscribeToOrderItemUpdates(onUpdate: () => void): RealtimeChannel {
  return supabase
    .channel("public:order_items")
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () =>
      onUpdate()
    )
    .subscribe();
}

/** Lắng nghe realtime khi order chuyển sang completed/cancelled hoặc payment_status đổi, cho một bàn cụ thể. */
export function subscribeToOrderUpdates(
  tableId: string,
  onUpdate: (order: OrdersRow) => void
): RealtimeChannel {
  return supabase
    .channel(`public:orders:table=${tableId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `table_id=eq.${tableId}` },
      (payload) => onUpdate(payload.new as OrdersRow)
    )
    .subscribe();
}

/** Lắng nghe realtime mọi thay đổi trên orders (mọi bàn) — dùng để làm mới lưới quản lý bàn của nhân viên. */
export function subscribeToAnyOrderUpdate(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("public:orders:any")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => onChange())
    .subscribe();
}

/** Chỉ bắn khi có ĐƠN MỚI (khách vừa gửi đơn) — dùng cho hệ thống cảnh báo chuông/rung của nhân viên. */
export function subscribeToNewOrders(onInsert: (order: OrdersRow) => void): RealtimeChannel {
  return supabase
    .channel("public:orders:alert")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => onInsert(payload.new as OrdersRow)
    )
    .subscribe();
}
