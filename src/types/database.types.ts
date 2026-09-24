/**
 * Kiểu dữ liệu khớp 1:1 với schema Supabase (PostgreSQL) của hệ thống Gọi Món.
 * File này đóng vai trò tương đương "supabase gen types typescript" thủ công,
 * dùng để typed hoá Supabase client (không dùng `any` ở bất kỳ đâu).
 */

/** Module 13: 'empty'/'ordering'/'paid' (cũ) đã đổi thành 4 giá trị dưới đây — xem ghi chú migration ở schema.sql. */
export type TableStatus = "available" | "occupied" | "payment_pending" | "needs_cleaning";
/** Hình dạng bàn (Module 13) — CHỈ ảnh hưởng hiển thị ở sơ đồ bàn, không ảnh hưởng nghiệp vụ. */
export type TableShape = "square" | "round" | "rectangle";
export type OrderStatus = "pending" | "preparing" | "completed" | "cancelled";
/** Module 13: 'dine_in' (mặc định, hành vi cũ — luôn gắn table_id) hoặc 'takeaway' (mang đi, table_id null). */
export type OrderType = "dine_in" | "takeaway";
export type OrderItemStatus = "pending" | "preparing" | "ready" | "served";
export type StationType = "bar" | "kitchen";
export type PaymentMethod = "cash" | "transfer";
export type PaymentStatus = "unpaid" | "paid";
export type StaffCallRequestType = "call_staff" | "need_ice" | "checkout";
export type StaffCallStatus = "pending" | "resolved";
export type UserRole = "admin" | "staff";
export type LoyaltyReason = "earn_order" | "manual_adjust";
export type ShiftStatus = "active" | "closed";
export type PromotionDiscountType = "percentage" | "fixed";
export type ExpenseCategory = "ingredient" | "utility" | "salary" | "other";

export interface TablesRow {
  id: string;
  table_number: number;
  qr_code_url: string | null;
  status: TableStatus;
  /** Khu vực bàn thuộc về (Tầng 1, Sân vườn...) — null nếu chưa gán, Module 13. */
  zone_id: string | null;
  /** Hình dạng bàn — CHỈ ảnh hưởng hiển thị ở sơ đồ bàn (Module 13). */
  shape: TableShape;
  created_at: string;
}

/** 1 khu vực/tầng của quán (Module 13) — dùng để nhóm bàn theo tab ở `/staff/tables`. */
export interface ZonesRow {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface CategoriesRow {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface MenuItemsRow {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  station_type: StationType;
  /** true (mặc định) = tự động bật lại "còn hàng" mỗi sáng qua Vercel Cron — Module 12. */
  auto_reset_daily: boolean;
  created_at: string;
}

export interface ItemOptionsRow {
  id: string;
  menu_item_id: string;
  option_name: string;
  additional_price: number;
}

export interface OrdersRow {
  id: string;
  /** NULLABLE từ Module 13 — null khi order_type = 'takeaway' (đơn mang đi không gắn bàn nào). */
  table_id: string | null;
  status: OrderStatus;
  total_amount: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  /** Khách hàng thân thiết gắn với đơn (null nếu khách không nhập SĐT lúc gửi đơn) — Module 5. */
  customer_id: string | null;
  /** Ca làm việc của nhân viên thu ngân đang trực lúc xác nhận thanh toán (null nếu chưa "Bắt đầu ca") — Module 8. */
  shift_id: string | null;
  /** Khuyến mãi/mã giảm giá đã áp dụng cho đơn (null nếu không dùng mã nào) — Module 9. */
  promotion_id: string | null;
  /** Số tiền đã giảm nhờ khuyến mãi (đã trừ vào total_amount) — lưu riêng để hiển thị/báo cáo, KHÔNG dùng để tính lại total_amount — Module 9. */
  discount_amount: number;
  /** 'dine_in' (mặc định) hoặc 'takeaway' — Module 13. */
  order_type: OrderType;
  /** Giờ hẹn lấy món của đơn mang đi — null nếu khách không chọn giờ cụ thể (lấy sớm nhất có thể) — Module 13. */
  pickup_time: string | null;
  /** Tên khách đặt mang đi — null cho đơn dine_in — Module 13. */
  customer_name: string | null;
  /** SĐT khách đặt mang đi — null cho đơn dine_in — Module 13. */
  customer_phone: string | null;
  created_at: string;
}

export interface OrderItemsRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  item_status: OrderItemStatus;
  station_type: StationType;
  /** Combo gốc nếu dòng này được "nổ" ra từ 1 combo (null cho món gọi lẻ) — Module 11. */
  combo_id: string | null;
  /** id do client tự sinh, dùng chung cho MỌI dòng nổ ra từ CÙNG 1 lần "Thêm combo vào giỏ" — Module 11. */
  combo_group_id: string | null;
  /** Tên combo tại thời điểm đặt (denormalized, giữ đúng tên dù combo bị đổi tên/xoá sau đó) — Module 11. */
  combo_name: string | null;
  created_at: string;
}

export interface VatInvoicesRow {
  id: string;
  order_id: string;
  company_name: string;
  tax_code: string;
  address: string;
  email: string;
  created_at: string;
}

export interface StaffCallsRow {
  id: string;
  table_id: string;
  request_type: StaffCallRequestType;
  status: StaffCallStatus;
  created_at: string;
}

/**
 * Hồ sơ tài khoản nội bộ (nhân viên/chủ quán) — `id` khớp 1:1 với
 * `auth.users.id`. Không có dòng nào tương ứng với khách quét QR (khách luôn
 * là Postgres role `anon`, không đăng nhập).
 */
export interface ProfilesRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

/**
 * Khách hàng thân thiết (Module 5) — định danh bằng số điện thoại, không gắn
 * `auth.users` (khách quét QR luôn ẩn danh, xem ghi chú RLS trong schema.sql).
 */
export interface CustomersRow {
  id: string;
  phone: string;
  name: string | null;
  points: number;
  total_spent: number;
  created_at: string;
}

/** Một dòng lịch sử tích/trừ điểm — hiện tại chỉ phát sinh từ thanh toán đơn (reason = 'earn_order'). */
export interface LoyaltyTransactionsRow {
  id: string;
  customer_id: string;
  order_id: string | null;
  points_change: number;
  reason: LoyaltyReason;
  created_at: string;
}

/** Đánh giá của khách sau khi bàn hoàn tất thanh toán — mỗi order chỉ 1 đánh giá (unique order_id). */
export interface FeedbacksRow {
  id: string;
  order_id: string;
  rating_beverage: number;
  rating_service: number;
  rating_space: number;
  comment: string | null;
  created_at: string;
}

/** Một nguyên liệu trong kho (Module 6) — `stock_quantity` có thể ÂM (xem ghi chú trong schema.sql). */
export interface IngredientsRow {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  min_threshold: number;
  created_at: string;
}

/** 1 dòng công thức: 1 món trong menu tiêu hao bao nhiêu đơn vị của 1 nguyên liệu. */
export interface RecipeItemsRow {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity_required: number;
}

/** Cấu hình toàn quán — LUÔN đúng 1 dòng (singleton table, xem schema.sql). */
export interface ShopSettingsRow {
  id: boolean;
  block_order_when_insufficient_stock: boolean;
  updated_at: string;
}

/**
 * Một ca làm việc (Module 8). `final_cash`/tổng doanh thu là null/0 cho tới
 * khi ca bị đóng (`status = 'closed'`) — chỉ được tính MỘT LẦN bởi hàm
 * `close_shift` lúc "Kết thúc ca" (xem ghi chú trong schema.sql), không cập
 * nhật realtime trong lúc ca đang mở.
 */
export interface ShiftsRow {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string | null;
  initial_cash: number;
  final_cash: number | null;
  total_revenue_cash: number;
  total_revenue_transfer: number;
  status: ShiftStatus;
  created_at: string;
  /**
   * Module 14: dấu vết chủ quán từng can thiệp tay vào ca này (đóng ca hộ,
   * hoặc sửa initial_cash/final_cash) — `null` nghĩa là ca chưa từng bị sửa.
   * 3 cột này LUÔN đi cùng nhau (cùng null hoặc cùng có giá trị).
   */
  admin_note: string | null;
  edited_by: string | null;
  edited_at: string | null;
}

/** Kết quả trả về của RPC `close_shift` — giống ShiftsRow + số đơn đã thu tiền trong ca (không lưu cột riêng, chỉ tính lúc đóng ca). */
export interface CloseShiftResultRow extends ShiftsRow {
  order_count: number;
}

/**
 * Một khuyến mãi/mã giảm giá (Module 9). `code` là `null` cho khuyến mãi TỰ
 * ĐỘNG áp dụng (Happy Hour, `requires_code = false`) — xem ghi chú chi tiết
 * trong schema.sql. `daily_start_time`/`daily_end_time` (dạng "HH:MM:SS") chỉ
 * có giá trị khi khuyến mãi giới hạn theo khung giờ vàng trong ngày.
 */
export interface PromotionsRow {
  id: string;
  code: string | null;
  description: string;
  discount_type: PromotionDiscountType;
  discount_value: number;
  min_order_value: number;
  start_time: string;
  end_time: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  requires_code: boolean;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

/**
 * 1 gói combo/set món ưu đãi (Module 11) — `price` là giá TRỌN GÓI, không
 * suy ra từ giá lẻ các món thành phần (xem combo_items). `is_active` quyết
 * định combo có hiển thị cho khách hay không (RLS chỉ cho khách đọc combo
 * đang active, xem schema.sql).
 */
export interface CombosRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

/** 1 món thành phần trong 1 combo — `quantity` là số lượng món đó CÓ TRONG 1 GÓI combo (chưa nhân số gói khách đặt). */
export interface ComboItemsRow {
  id: string;
  combo_id: string;
  menu_item_id: string;
  quantity: number;
}

/**
 * 1 khoản chi phí quán (Module 12) — `expense_date` là NGÀY (không giờ),
 * mặc định ngày hiện tại lúc nhập nhưng chủ quán có thể chọn lại ngày chi
 * thực tế (vd nhập bù hoá đơn điện nước của tháng trước). `created_by` nullable
 * vì xoá tài khoản nhân viên không được xoá luôn lịch sử chi phí họ đã nhập.
 */
export interface ExpensesRow {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}

// `Relationships` bắt buộc phải có mặt (dù rỗng) để khớp đúng ràng buộc
// generic `GenericTable` của @supabase/supabase-js — thiếu trường này khiến
// TypeScript không suy luận được kiểu tham số cho .select()/.update() (sụp
// thành `never`), lộ rõ nhất khi dùng client tạo bằng `createClient` thuần
// (xem lib/supabase/admin.ts) thay vì qua @supabase/ssr. Dự án này không
// dùng kiểu embed tự động qua `Relationships` (mọi select có join đều tự ép
// kiểu tường minh bằng `as unknown as T`, xem order.service.ts), nên để
// rỗng là đủ — không cần khai báo FK thật cho từng bảng.
type TableDefinition<Row, Insert, Update, Relationships = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export interface Database {
  public: {
    Tables: {
      tables: TableDefinition<
        TablesRow,
        Omit<TablesRow, "id" | "created_at" | "status" | "zone_id" | "shape"> &
          Partial<Pick<TablesRow, "status" | "zone_id" | "shape">>,
        Partial<Omit<TablesRow, "id" | "created_at">>
      >;
      zones: TableDefinition<
        ZonesRow,
        Omit<ZonesRow, "id" | "created_at" | "display_order"> & Partial<Pick<ZonesRow, "display_order">>,
        Partial<Omit<ZonesRow, "id" | "created_at">>
      >;
      categories: TableDefinition<
        CategoriesRow,
        Omit<CategoriesRow, "id" | "created_at">,
        Partial<Omit<CategoriesRow, "id" | "created_at">>
      >;
      menu_items: TableDefinition<
        MenuItemsRow,
        Omit<MenuItemsRow, "id" | "created_at" | "is_available" | "auto_reset_daily"> &
          Partial<Pick<MenuItemsRow, "is_available" | "auto_reset_daily">>,
        Partial<Omit<MenuItemsRow, "id" | "created_at">>
      >;
      item_options: TableDefinition<
        ItemOptionsRow,
        Omit<ItemOptionsRow, "id">,
        Partial<Omit<ItemOptionsRow, "id">>
      >;
      orders: TableDefinition<
        OrdersRow,
        Omit<
          OrdersRow,
          | "id"
          | "created_at"
          | "status"
          | "payment_status"
          | "customer_id"
          | "shift_id"
          | "promotion_id"
          | "discount_amount"
          | "table_id"
          | "order_type"
          | "pickup_time"
          | "customer_name"
          | "customer_phone"
        > &
          Partial<
            Pick<
              OrdersRow,
              | "status"
              | "payment_status"
              | "customer_id"
              | "shift_id"
              | "promotion_id"
              | "discount_amount"
              | "table_id"
              | "order_type"
              | "pickup_time"
              | "customer_name"
              | "customer_phone"
            >
          >,
        Partial<Omit<OrdersRow, "id" | "created_at">>
      >;
      order_items: TableDefinition<
        OrderItemsRow,
        Omit<OrderItemsRow, "id" | "created_at" | "item_status" | "combo_id" | "combo_group_id" | "combo_name"> &
          Partial<Pick<OrderItemsRow, "item_status" | "combo_id" | "combo_group_id" | "combo_name">>,
        Partial<Omit<OrderItemsRow, "id" | "created_at">>
      >;
      vat_invoices: TableDefinition<
        VatInvoicesRow,
        Omit<VatInvoicesRow, "id" | "created_at">,
        Partial<Omit<VatInvoicesRow, "id" | "created_at">>
      >;
      staff_calls: TableDefinition<
        StaffCallsRow,
        Omit<StaffCallsRow, "id" | "created_at" | "status"> &
          Partial<Pick<StaffCallsRow, "status">>,
        Partial<Omit<StaffCallsRow, "id" | "created_at">>
      >;
      profiles: TableDefinition<
        ProfilesRow,
        Omit<ProfilesRow, "created_at" | "full_name" | "role"> &
          Partial<Pick<ProfilesRow, "full_name" | "role">>,
        Partial<Omit<ProfilesRow, "id" | "created_at">>
      >;
      customers: TableDefinition<
        CustomersRow,
        Omit<CustomersRow, "id" | "created_at" | "points" | "total_spent" | "name"> &
          Partial<Pick<CustomersRow, "points" | "total_spent" | "name">>,
        Partial<Omit<CustomersRow, "id" | "created_at">>
      >;
      loyalty_transactions: TableDefinition<
        LoyaltyTransactionsRow,
        Omit<LoyaltyTransactionsRow, "id" | "created_at" | "reason"> &
          Partial<Pick<LoyaltyTransactionsRow, "reason">>,
        Partial<Omit<LoyaltyTransactionsRow, "id" | "created_at">>
      >;
      feedbacks: TableDefinition<
        FeedbacksRow,
        Omit<FeedbacksRow, "id" | "created_at" | "comment"> & Partial<Pick<FeedbacksRow, "comment">>,
        Partial<Omit<FeedbacksRow, "id" | "created_at">>
      >;
      ingredients: TableDefinition<
        IngredientsRow,
        Omit<IngredientsRow, "id" | "created_at" | "stock_quantity"> &
          Partial<Pick<IngredientsRow, "stock_quantity">>,
        Partial<Omit<IngredientsRow, "id" | "created_at">>
      >;
      recipe_items: TableDefinition<
        RecipeItemsRow,
        Omit<RecipeItemsRow, "id">,
        Partial<Omit<RecipeItemsRow, "id">>
      >;
      shop_settings: TableDefinition<
        ShopSettingsRow,
        ShopSettingsRow,
        Partial<Omit<ShopSettingsRow, "id">>
      >;
      shifts: TableDefinition<
        ShiftsRow,
        Omit<
          ShiftsRow,
          | "id"
          | "created_at"
          | "start_time"
          | "end_time"
          | "final_cash"
          | "total_revenue_cash"
          | "total_revenue_transfer"
          | "status"
          | "admin_note"
          | "edited_by"
          | "edited_at"
        > &
          Partial<
            Pick<
              ShiftsRow,
              | "start_time"
              | "end_time"
              | "final_cash"
              | "total_revenue_cash"
              | "total_revenue_transfer"
              | "status"
              | "admin_note"
              | "edited_by"
              | "edited_at"
            >
          >,
        Partial<Omit<ShiftsRow, "id" | "created_at">>
      >;
      promotions: TableDefinition<
        PromotionsRow,
        Omit<PromotionsRow, "id" | "created_at" | "times_used" | "is_active"> &
          Partial<Pick<PromotionsRow, "times_used" | "is_active">>,
        Partial<Omit<PromotionsRow, "id" | "created_at">>
      >;
      combos: TableDefinition<
        CombosRow,
        Omit<CombosRow, "id" | "created_at" | "is_active" | "display_order"> &
          Partial<Pick<CombosRow, "is_active" | "display_order">>,
        Partial<Omit<CombosRow, "id" | "created_at">>
      >;
      combo_items: TableDefinition<
        ComboItemsRow,
        Omit<ComboItemsRow, "id" | "quantity"> & Partial<Pick<ComboItemsRow, "quantity">>,
        Partial<Omit<ComboItemsRow, "id">>
      >;
      expenses: TableDefinition<
        ExpensesRow,
        Omit<ExpensesRow, "id" | "created_at" | "expense_date" | "note" | "created_by"> &
          Partial<Pick<ExpensesRow, "expense_date" | "note" | "created_by">>,
        Partial<Omit<ExpensesRow, "id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      award_loyalty_points: {
        Args: {
          p_customer_id: string;
          p_order_id: string | null;
          p_points: number;
          p_amount: number;
        };
        Returns: void;
      };
      deduct_inventory_for_order_item: {
        Args: {
          p_menu_item_id: string;
          p_quantity_ordered: number;
        };
        Returns: void;
      };
      adjust_ingredient_stock: {
        Args: {
          p_ingredient_id: string;
          p_delta: number;
        };
        Returns: void;
      };
      close_shift: {
        Args: {
          p_shift_id: string;
          p_final_cash: number;
          /** Module 14: chỉ truyền khi CHỦ QUÁN đóng ca hộ nhân viên — bỏ trống ở luồng nhân viên tự đóng ca. */
          p_admin_note?: string | null;
        };
        Returns: CloseShiftResultRow[];
      };
      redeem_promotion: {
        Args: {
          p_promotion_id: string;
          p_order_subtotal: number;
        };
        Returns: number;
      };
      release_promotion_usage: {
        Args: {
          p_promotion_id: string;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}
