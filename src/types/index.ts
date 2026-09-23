import type {
  ComboItemsRow,
  CombosRow,
  CustomersRow,
  FeedbacksRow,
  ItemOptionsRow,
  LoyaltyTransactionsRow,
  MenuItemsRow,
  OrderItemStatus,
  OrderItemsRow,
  OrdersRow,
  PaymentMethod,
  PromotionDiscountType,
  PromotionsRow,
  RecipeItemsRow,
  ShiftStatus,
  ShiftsRow,
  StaffCallRequestType,
  StaffCallsRow,
  StationType,
  TablesRow,
  TableStatus,
  UserRole,
  VatInvoicesRow,
} from "./database.types";

/** Món trong menu kèm danh sách option (topping) của nó — dùng để hiển thị. */
export interface MenuItemWithOptions extends MenuItemsRow {
  options: ItemOptionsRow[];
}

/** Danh mục kèm danh sách món thuộc danh mục đó (đã lọc theo is_available khi cần). */
export interface CategoryWithItems {
  id: string;
  name: string;
  display_order: number;
  items: MenuItemWithOptions[];
}

/** Một dòng trong giỏ hàng phía client, trước khi được gửi lên thành order_items. */
export interface CartLine {
  /** id tạm sinh ở client (crypto.randomUUID) để React key + thao tác sửa/xoá. */
  cartLineId: string;
  menuItem: MenuItemWithOptions;
  quantity: number;
  selectedOptions: ItemOptionsRow[];
  note: string;
  /**
   * Đơn giá đã cộng dồn giá option, KHÔNG nhân số lượng. CHO DÒNG COMBO (xem
   * 3 field bên dưới, Module 11): CHỈ dòng ĐẦU TIÊN nổ ra từ 1 combo mang giá
   * trọn gói (combos.price) trong field này, các dòng thành phần còn lại
   * luôn là 0 — để tổng giỏ hàng (sum lineTotal) bằng đúng giá combo thay vì
   * cộng nhầm theo giá lẻ từng món, xem CartContext.addComboLines.
   */
  unitPrice: number;
  /** unitPrice * quantity (RIÊNG dòng combo: xem ghi chú ở unitPrice — bất biến này vẫn đúng vì unitPrice đã được đặt phù hợp). */
  lineTotal: number;
  stationType: StationType;
  /** Combo gốc nếu dòng này được "nổ" ra từ 1 combo — null/undefined cho món gọi lẻ thông thường (Module 11). */
  comboId?: string | null;
  /** id dùng chung cho MỌI dòng nổ ra từ CÙNG 1 lần "Thêm combo vào giỏ" — dùng để giỏ hàng gộp nhóm hiển thị (Module 11). */
  comboGroupId?: string | null;
  /** Tên combo tại thời điểm thêm vào giỏ — hiển thị ở "thẻ combo" trong giỏ hàng (Module 11). */
  comboName?: string | null;
}

/** order_item kèm thông tin món để hiển thị ở màn hình theo dõi trạng thái. */
export interface OrderItemWithMenu extends OrderItemsRow {
  menu_item: Pick<MenuItemsRow, "id" | "name" | "image_url" | "price"> | null;
}

/** order kèm toàn bộ order_items — dùng cho màn hình trạng thái đơn của khách. */
export interface OrderWithItems extends OrdersRow {
  order_items: OrderItemWithMenu[];
}

export interface CreateOrderInput {
  tableId: string;
  lines: CartLine[];
  /** Khách hàng thân thiết đã tra cứu/đăng ký ở bước giỏ hàng (Module 5) — có thể null. */
  customerId?: string | null;
  /**
   * Khuyến mãi đã được xem trước hợp lệ ở giỏ hàng (Module 9) — RPC
   * `redeem_promotion` ở server LUÔN kiểm tra lại toàn bộ điều kiện, không
   * tin tưởng riêng việc client "đã thấy hợp lệ" lúc xem trước.
   */
  promotionId?: string | null;
}

export interface VatInvoiceInput {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

export interface CheckoutInput {
  orderId: string;
  paymentMethod: PaymentMethod;
}

export const ORDER_ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending: "Chờ xử lý",
  preparing: "Đang làm",
  ready: "Đã xong",
  served: "Đã phục vụ",
};

// ---------------------------------------------------------------------------
// Module 2 — Nhân viên (KDS, quản lý bàn, hết món nhanh)
// ---------------------------------------------------------------------------

/**
 * Trạng thái bàn dùng đúng 3 giá trị enum sẵn có của schema, nhưng ở tầng UI
 * nhân viên hiển thị theo đúng ngữ nghĩa vận hành thực tế:
 * empty = Trống, ordering = Đang gọi món, paid = Chờ thanh toán (khách đã yêu
 * cầu thanh toán / nhân viên đang xử lý — KHÔNG phải nghĩa "đã thanh toán
 * xong", việc xác nhận thu tiền xong sẽ đưa bàn thẳng về "empty" để đón khách
 * mới, xem order.service.markOrdersPaid).
 */
export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  empty: "Trống",
  ordering: "Đang gọi món",
  paid: "Chờ thanh toán",
};

export const STAFF_CALL_LABEL: Record<StaffCallRequestType, string> = {
  call_staff: "Gọi nhân viên",
  need_ice: "Xin thêm đá",
  checkout: "Yêu cầu thanh toán",
};

/** Một vé món trên màn hình KDS — đã làm phẳng dữ liệu (tên món, số bàn) để render trực tiếp. */
export interface KdsTicket {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  table_number: number | null;
  quantity: number;
  notes: string | null;
  item_status: OrderItemStatus;
  station_type: StationType;
  /** Tên combo nếu món này là 1 thành phần nổ ra từ combo — null cho món gọi lẻ (Module 11). */
  combo_name: string | null;
  created_at: string;
}

export interface StaffCallWithTable extends StaffCallsRow {
  table_number: number | null;
}

/** Bàn kèm các đơn đang hoạt động — dùng cho lưới quản lý bàn của nhân viên. */
export interface TableWithOrders extends TablesRow {
  activeOrders: OrderWithItems[];
  pendingStaffCalls: StaffCallWithTable[];
}

export const NEXT_ORDER_ITEM_STATUS: Record<OrderItemStatus, OrderItemStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
};

export const ADVANCE_ACTION_LABEL: Record<OrderItemStatus, string> = {
  pending: "Bắt đầu làm",
  preparing: "Hoàn thành",
  ready: "Đã phục vụ",
  served: "",
};

/** Ngưỡng cảnh báo món để lâu chưa xử lý, tính bằng phút. */
export const KDS_WARN_MINUTES = 10;
export const KDS_DANGER_MINUTES = 15;

/** Nhãn hiển thị của khu vực chế biến — dùng chung cho KDS (Module 2) và quản lý menu (Module 3). */
export const STATION_TYPE_LABEL: Record<StationType, string> = {
  bar: "Pha chế (Bar)",
  kitchen: "Bếp",
};

// ---------------------------------------------------------------------------
// Module 3 — Chủ quán (Dashboard, thống kê, quản lý menu, hoá đơn VAT)
// ---------------------------------------------------------------------------

/** Số liệu tổng quan cho các thẻ thống kê đầu trang Dashboard. */
export interface DashboardSummary {
  revenueToday: number;
  ordersToday: number;
  vatInvoicesToday: number;
  tableStatusCounts: Record<TableStatus, number>;
}

/** Một điểm dữ liệu trên biểu đồ doanh thu (theo giờ hoặc theo ngày, tuỳ khoảng thời gian đã chọn). */
export interface RevenuePoint {
  label: string;
  revenue: number;
}

export type RevenueRange = "today" | "7d";

/**
 * Một dòng trong bảng xếp hạng best-seller. `revenue` tính theo GIÁ HIỆN TẠI
 * của món (order_items không lưu giá tại thời điểm đặt — xem ghi chú ở
 * analytics.service.ts), nên chỉ mang tính ước tính tham khảo.
 */
export interface BestSellerRow {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

/** Hoá đơn VAT kèm thông tin đơn hàng gốc (tổng tiền, số bàn) — dùng cho trang danh sách của chủ quán. */
export interface VatInvoiceWithOrder extends VatInvoicesRow {
  order: { id: string; total_amount: number; table_number: number | null; created_at: string } | null;
}

/** Input tạo/sửa danh mục món — admin đặt lại display_order để sắp xếp thứ tự hiển thị trên menu khách. */
export interface CategoryFormInput {
  name: string;
  displayOrder: number;
}

/** Input tạo/sửa một món trong menu (chưa gồm options — quản lý riêng theo từng dòng). */
export interface MenuItemFormInput {
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stationType: StationType;
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Module 4 — Auth & phân quyền
// ---------------------------------------------------------------------------

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: "Chủ quán",
  staff: "Nhân viên",
};

/** Input tạo tài khoản nhân viên/chủ quán mới ở `/admin/staff` (mở rộng Module 4) — gửi qua Route Handler `/api/admin/staff`, xem staff.service.ts#createStaffAccount. */
export interface StaffAccountFormInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

/** Lỗi nghiệp vụ có message tiếng Việt an toàn để hiển thị trực tiếp lên toast. */
export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

// ---------------------------------------------------------------------------
// Module 5 — Vận hành nâng cao: In nhiệt trực tiếp, Khách hàng thân thiết, Đánh giá
// ---------------------------------------------------------------------------

/** Kết quả tra cứu/tự đăng ký khách hàng thân thiết theo số điện thoại. */
export interface CustomerIdentity {
  id: string;
  phone: string;
  name: string | null;
  points: number;
  totalSpent: number;
  /** true nếu vừa được tạo mới (lần đầu tra cứu SĐT này), dùng để hiển thị thông báo phù hợp. */
  isNew: boolean;
}

/** Một dòng lịch sử tích điểm hiển thị trên widget của khách — đã làm phẳng, không cần join thêm. */
export interface LoyaltyHistoryEntry extends Pick<LoyaltyTransactionsRow, "id" | "points_change" | "reason" | "created_at"> {
  orderShortId: string | null;
}

export const LOYALTY_REASON_LABEL: Record<LoyaltyTransactionsRow["reason"], string> = {
  earn_order: "Tích điểm từ đơn hàng",
  manual_adjust: "Điều chỉnh thủ công",
};

/** Số tiền quy đổi 1 điểm thưởng — 10.000đ = 1 điểm. */
export const POINTS_PER_VND = 10000;

/** Input gửi đánh giá sau thanh toán (1-5 sao mỗi hạng mục + nhận xét tự do). */
export interface FeedbackInput {
  orderId: string;
  ratingBeverage: number;
  ratingService: number;
  ratingSpace: number;
  comment: string;
  /**
   * Số bàn — CHỈ dùng để bắn thông báo Telegram (Module 7), không lưu vào
   * bảng `feedbacks`. Do caller (màn hình khách) truyền vào thay vì service
   * tự query lại, vì khách (anon) chỉ có policy RLS INSERT trên `feedbacks`,
   * không có SELECT — xem ghi chú tương tự ở staffCall.service.createStaffCall.
   */
  tableNumber?: number | null;
}

/** Đánh giá kèm thông tin đơn/bàn gốc — dùng cho trang /admin/feedbacks. */
export interface FeedbackWithOrder extends FeedbacksRow {
  order: { total_amount: number; table_number: number | null } | null;
}

export const FEEDBACK_CRITERIA_LABEL = {
  ratingBeverage: "Đồ uống",
  ratingService: "Phục vụ",
  ratingSpace: "Không gian",
} as const;

// ---- In nhiệt trực tiếp (Module 5) ----

export type PrinterConnection = "lan" | "bluetooth";

/**
 * Cấu hình máy in nhiệt — lưu localStorage THEO TỪNG THIẾT BỊ thu ngân (mỗi
 * máy/tablet ở quầy có thể dùng chung 1 máy in LAN, hoặc ghép Bluetooth riêng
 * cho từng thiết bị), không lưu trên Supabase vì đây là thiết lập phần cứng
 * cục bộ, không phải dữ liệu nghiệp vụ cần đồng bộ nhiều thiết bị.
 */
export interface PrinterSettings {
  connection: PrinterConnection;
  /** IP máy in trong mạng LAN của quán, ví dụ 192.168.1.100. */
  lanIp: string;
  /** Cổng giao tiếp ESC/POS qua TCP — mặc định 9100 (chuẩn phổ biến nhất). */
  lanPort: number;
  /** UUID service/characteristic GATT của máy in Bluetooth (BLE) — KHÁC nhau tuỳ hãng, cần đối chiếu tài liệu máy in cụ thể. */
  bleServiceUuid: string;
  bleCharacteristicUuid: string;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  connection: "lan",
  lanIp: "",
  lanPort: 9100,
  // UUID thường gặp ở các module máy in nhiệt BLE giá rẻ (58mm/80mm) — CHỈ là
  // giá trị mặc định gợi ý, không phải chuẩn chung cho mọi hãng máy in.
  bleServiceUuid: "000018f0-0000-1000-8000-00805f9b34fb",
  bleCharacteristicUuid: "00002af1-0000-1000-8000-00805f9b34fb",
};

/** Dữ liệu cần có để in hoá đơn nhiệt 80mm — độc lập với OrderWithItems để print.service.ts không phụ thuộc ngược vào service khác. */
export interface ReceiptData {
  shopName: string;
  tableNumber: number;
  printedAt: Date;
  orders: {
    orderShortId: string;
    items: {
      name: string;
      quantity: number;
      notes: string | null;
      /** Nhóm combo (nếu món này thuộc 1 combo) — dùng để gộp in các thành phần dưới 1 dòng "COMBO: tên" (Module 11). */
      comboGroupId?: string | null;
      comboName?: string | null;
    }[];
  }[];
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
  vat: { companyName: string; taxCode: string } | null;
}

// ---------------------------------------------------------------------------
// Module 6 — Quản lý kho theo công thức (Recipe-based Inventory)
// ---------------------------------------------------------------------------

/** 1 dòng công thức kèm tên/đơn vị nguyên liệu — dùng để hiển thị (tránh UI phải tự join). */
export interface RecipeItemWithIngredient extends RecipeItemsRow {
  ingredientName: string;
  ingredientUnit: string;
}

/** Input form thêm/sửa nguyên liệu (KHÔNG gồm stock_quantity — nhập/trừ kho luôn qua RPC atomic riêng, xem StockAdjustmentInput). */
export interface IngredientFormInput {
  name: string;
  unit: string;
  minThreshold: number;
}

/** Input nhập thêm hàng — số lượng CỘNG THÊM vào kho hiện có (số dương). */
export interface StockAdjustmentInput {
  ingredientId: string;
  quantityToAdd: number;
}

/** 1 dòng trong bảng công thức đang chỉnh sửa cho 1 món (Admin chọn món -> sửa danh sách nguyên liệu cần). */
export interface RecipeDraftLine {
  ingredientId: string;
  quantityRequired: number;
}

/** Kết quả kiểm tra + trừ kho cho 1 order_item khi chuyển sang 'preparing' — tên nguyên liệu không đủ (rỗng nếu đủ). */
export interface InventoryDeductionResult {
  insufficientIngredients: string[];
}

// ---------------------------------------------------------------------------
// Module 7 — Thông báo tự động (Realtime UI + Telegram)
// ---------------------------------------------------------------------------

/** 1 món trong đơn — dùng để liệt kê trong tin nhắn Telegram báo đơn mới (không cần toàn bộ OrderItemWithMenu). */
export interface TelegramOrderItemSummary {
  name: string;
  quantity: number;
}

/**
 * Payload gửi tới `POST /api/notify/telegram` — union theo `type`, mỗi
 * nhánh chỉ mang đúng dữ liệu cần để route dựng nội dung tin nhắn ở SERVER
 * (route KHÔNG nhận text tự do từ client, tránh client tự ý gửi nội dung tuỳ
 * ý qua bot của quán — xem ghi chú bảo mật ở route.ts).
 */
export type TelegramNotifyPayload =
  | { type: "new_order"; tableNumber: number; items: TelegramOrderItemSummary[]; totalAmount: number }
  | { type: "staff_call"; tableNumber: number; requestType: StaffCallRequestType }
  | {
      type: "new_feedback";
      tableNumber: number | null;
      ratingBeverage: number;
      ratingService: number;
      ratingSpace: number;
      comment: string | null;
    };

// ---------------------------------------------------------------------------
// Module 8 — Quản lý ca làm việc & Chấm công nhân viên (Staff Shifts)
// ---------------------------------------------------------------------------

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  active: "Đang mở",
  closed: "Đã đóng",
};

/** Ca làm việc kèm tên nhân viên — dùng cho danh sách lịch sử ở `/admin/shifts`. */
export interface ShiftWithStaff extends ShiftsRow {
  staffName: string;
}

// ---------------------------------------------------------------------------
// Module 9 — Khuyến mãi, Mã giảm giá & Khung giờ vàng
// ---------------------------------------------------------------------------

export const PROMOTION_DISCOUNT_TYPE_LABEL: Record<PromotionDiscountType, string> = {
  percentage: "Theo phần trăm (%)",
  fixed: "Số tiền cố định",
};

/**
 * Dữ liệu form thêm/sửa khuyến mãi ở `/admin/promotions` — `startTime`/
 * `endTime` là chuỗi ISO (từ input datetime-local), `dailyStartTime`/
 * `dailyEndTime` là chuỗi "HH:MM" (từ input time) hoặc `null` nếu không giới
 * hạn theo khung giờ trong ngày.
 */
export interface PromotionFormInput {
  /** `null` khi `requiresCode = false` (khuyến mãi Happy Hour tự động áp dụng). */
  code: string | null;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  minOrderValue: number;
  startTime: string;
  endTime: string;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  requiresCode: boolean;
  usageLimit: number | null;
}

/**
 * Kết quả xem trước 1 khuyến mãi ở giỏ hàng (Module 1) — tính THUẦN CLIENT để
 * hiển thị ngay không cần round-trip server. RPC `redeem_promotion` ở server
 * luôn là nguồn xác thực CUỐI CÙNG lúc gửi đơn (xem
 * order.service.createOrder), bản xem trước này chỉ phục vụ UI.
 */
export interface PromotionPreview {
  eligible: boolean;
  discountAmount: number;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Module 10 — Phân tích dữ liệu nâng cao & Báo cáo kinh doanh thông minh
// ---------------------------------------------------------------------------

/** Nhãn thứ trong tuần theo quy ước Việt Nam (Thứ 2 đứng đầu tuần) — index 0 = Thứ 2 ... 6 = Chủ Nhật, dùng chung cho biểu đồ tuần và heatmap. */
export const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"] as const;

/** 3 khoảng thời gian dựng sẵn + 1 lựa chọn tự chọn ngày ở trang `/admin/analytics`. */
export type AnalyticsPreset = "today" | "7d" | "month" | "custom";

export const ANALYTICS_PRESET_LABEL: Record<AnalyticsPreset, string> = {
  today: "Hôm nay",
  "7d": "7 ngày qua",
  month: "Tháng này",
  custom: "Tuỳ chỉnh",
};

/** Khoảng thời gian đã được quy đổi từ 1 `AnalyticsPreset` — xem `lib/analytics.ts#resolveAnalyticsRange`. */
export interface AnalyticsDateRange {
  from: Date;
  to: Date;
}

/**
 * Số liệu tổng hợp cho trang `/admin/analytics`. `averageOrderValue` (AOV)
 * chỉ tính trên đơn ĐÃ THANH TOÁN (`paidOrdersCount` làm mẫu số), trong khi
 * `ordersCount` đếm TOÀN BỘ đơn phát sinh trong khoảng thời gian kể cả chưa
 * thanh toán — giữ đúng quy ước "ordersToday" đã dùng ở `DashboardSummary`
 * (Module 3), tránh 2 định nghĩa "số đơn" khác nhau trên cùng hệ thống.
 */
export interface AdvancedMetrics {
  revenueTotal: number;
  ordersCount: number;
  paidOrdersCount: number;
  averageOrderValue: number;
  /** % (0-100), làm tròn 1 chữ số thập phân. */
  retentionRate: number;
  returningCustomers: number;
  newCustomers: number;
  /** Tổng số khách hàng thân thiết (có customer_id) từng đặt đơn trong khoảng đang xem — mẫu số của retentionRate. */
  totalCustomersInRange: number;
}

/** Doanh thu gộp theo thứ trong tuần (Thứ 2 -> Chủ Nhật) trong khoảng thời gian đang lọc — chỉ tính đơn đã thanh toán. */
export interface WeekdayRevenuePoint {
  weekdayIndex: number;
  label: string;
  revenue: number;
}

/**
 * 1 ô trong heatmap "khung giờ vàng" — `orderCount` là số LƯỢT ĐẶT MÓN
 * (KHÔNG lọc theo trạng thái thanh toán, vì đây là chỉ số đo LƯU LƯỢNG khách
 * ghé/gọi món, khác bản chất với biểu đồ doanh thu).
 */
export interface HeatmapCell {
  weekdayIndex: number;
  hour: number;
  orderCount: number;
}

/** Toàn bộ dữ liệu cho trang `/admin/analytics`, tải song song trong 1 lượt gọi `analytics.service.getAnalyticsReport`. */
export interface AnalyticsReport {
  metrics: AdvancedMetrics;
  weekdayTrend: WeekdayRevenuePoint[];
  heatmap: HeatmapCell[];
  topItems: BestSellerRow[];
}

export type SmartInsightTone = "up" | "down" | "neutral";

/**
 * 1 nhận định tự động sinh ra ở trang chủ Admin Dashboard — sinh bằng LUẬT CỐ
 * ĐỊNH so sánh dữ liệu (rules-based text generation), KHÔNG gọi mô hình AI
 * nào dù tên gọi "Smart Insights" theo đúng yêu cầu nghiệp vụ. Xem
 * `analytics.service.ts#getSmartInsights`.
 */
export interface SmartInsight {
  id: string;
  text: string;
  tone: SmartInsightTone;
}

// ---------------------------------------------------------------------------
// Module 11 — Quản lý Combo & Set món ưu đãi (Combo & Set Menu Management)
// ---------------------------------------------------------------------------

/**
 * 1 món thành phần trong combo, kèm ĐẦY ĐỦ thông tin món (không chỉ id) — dùng
 * để hiển thị chi tiết combo cho khách VÀ để "nổ" (explode) thành 1 CartLine
 * hoàn chỉnh khi khách thêm combo vào giỏ (xem CartContext.addComboLines).
 * `quantity` là số lượng món đó có trong 1 GÓI combo (chưa nhân số gói khách
 * chọn ở ComboDetailSheet).
 */
export interface ComboItemWithMenu {
  id: string;
  menuItem: MenuItemsRow;
  quantity: number;
}

/** Combo kèm danh sách món thành phần — dùng cho mục "Combo Tiết Kiệm" (Module 1) và trang quản trị `/admin/combos`. */
export interface ComboWithItems extends CombosRow {
  items: ComboItemWithMenu[];
}

/** 1 dòng trong danh sách món đang soạn cho combo ở `ComboFormDialog` (chưa lưu DB) — chỉ giữ tên để hiển thị, không cần load lại toàn bộ menu item. */
export interface ComboItemDraft {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}

/**
 * Input tạo/sửa combo ở `/admin/combos`. `items` LUÔN thay thế TOÀN BỘ danh
 * sách món thành phần hiện có của combo (replace-all, đơn giản hơn diff từng
 * dòng) — xem combo.service.ts#saveCombo.
 */
export interface ComboFormInput {
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  items: ComboItemDraft[];
}
