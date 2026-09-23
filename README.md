# Gọi Món — Module 1 → 11

WebApp quản lý quán cà phê đa nền tảng — quy mô 15 bàn, gồm 3 module nghiệp vụ
(Khách hàng / Nhân viên / Chủ quán) + 1 module bảo mật + 7 module vận hành
nâng cao. Đã hoàn thành:

- **Module 1 — Khách hàng gọi món (Mobile Web)**: `/order`, `/order/cart`, `/order/status`.
- **Module 2 — Nhân viên (KDS, quản lý bàn, hết món nhanh)**: `/staff/kds`, `/staff/tables`, `/staff/menu-control`.
- **Module 3 — Dashboard chủ quán (PC/Tablet)**: `/admin/dashboard`, `/admin/menu`, `/admin/vat-invoices`.
- **Module 4 — Auth & phân quyền**: `/login` + Supabase Auth + RLS theo vai
  trò, bảo vệ toàn bộ `/staff/*` và `/admin/*` bằng Next.js Middleware.
- **Module 5 — Vận hành nâng cao**: in hoá đơn nhiệt trực tiếp (LAN/Bluetooth,
  không qua hộp thoại in trình duyệt), khách hàng thân thiết & tích điểm,
  đánh giá sau thanh toán (`/admin/feedbacks`).
- **Module 6 — Quản lý kho theo công thức**: `ingredients`/`recipe_items`, tự
  động trừ kho khi bếp bắt đầu làm món, cảnh báo sắp hết hàng, trang quản trị
  kho `/admin/inventory`.
- **Module 7 — Thông báo tự động**: rung/toast/nhấp nháy ngay lập tức trên
  màn hình khách + nhân viên + chủ quán khi có sự kiện mới, cộng với báo cáo
  qua Telegram Bot (đơn mới, gọi nhân viên, đánh giá mới) — hoàn toàn miễn
  phí, không thêm dependency nào.
- **Module 8 — Quản lý ca làm việc & Chấm công**: nhân viên "Bắt đầu ca"
  (nhập tiền đầu ca)/"Kết thúc ca" (báo cáo chốt ca tự động) ngay trên
  `StaffNav`, đơn hàng được gắn vào ca của nhân viên thu ngân lúc xác nhận
  thanh toán, trang quản trị `/admin/shifts` để chủ quán theo dõi lịch sử ca
  và đối chiếu chênh lệch tiền mặt.
- **Module 9 — Khuyến mãi, Mã giảm giá & Khung giờ vàng**: khách tự nhập mã
  giảm giá ở giỏ hàng (`/order/cart`) hoặc được TỰ ĐỘNG áp dụng khuyến mãi
  Happy Hour đang trong khung giờ vàng, trang quản trị `/admin/promotions` để
  chủ quán tạo/sửa/bật-tắt mã và theo dõi số lượt đã dùng.
- **Module 10 — Phân tích dữ liệu nâng cao & Báo cáo kinh doanh thông minh**:
  "Nhận định thông minh" (rules-based, không phải AI thật) ngay trên
  `/admin/dashboard` so sánh tuần này với tuần trước, trang báo cáo chi tiết
  `/admin/analytics` với AOV, tỷ lệ khách quay lại, heatmap khung giờ vàng,
  xu hướng doanh thu theo thứ trong tuần, lọc theo khoảng thời gian tuỳ chọn
  và xuất CSV.
- **Module 11 — Quản lý Combo & Set món ưu đãi**: mục "Combo Tiết Kiệm" trên
  thực đơn của khách (`/order`), khách xem chi tiết món bên trong rồi thêm
  nguyên gói vào giỏ hàng, KDS hiển thị rõ combo nào cho từng món, hoá đơn
  nhiệt gộp in các thành phần dưới 1 dòng "COMBO", trang quản trị
  `/admin/combos` để chủ quán tạo combo/chọn món/gán giá/bật-tắt hiển thị
  realtime.

Cả 11 module dùng chung `database.types.ts` và toàn bộ `services/*` — không có
service/type nào bị viết trùng giữa các module.

## 1. Cấu trúc thư mục

```
goimon/
├── src/
│   ├── middleware.ts                # (Module 4) Bảo vệ /staff/* và /admin/*
│   ├── app/
│   │   ├── layout.tsx              # Root layout (font, Toaster)
│   │   ├── page.tsx                # "/" -> redirect sang /order kèm ?table=
│   │   ├── globals.css
│   │   ├── login/page.tsx          # (Module 4) Đăng nhập chung /staff + /admin
│   │   ├── order/                  # Module 1 (Khách hàng) — KHÔNG qua middleware, luôn công khai
│   │   │   ├── layout.tsx          # Bọc TableProvider + CartProvider
│   │   │   ├── page.tsx            # Màn hình thực đơn + mục "Combo Tiết Kiệm" (Module 11)
│   │   │   ├── cart/page.tsx       # Giỏ hàng + gửi đơn + áp dụng mã giảm giá/Happy Hour (Module 9) + gộp nhóm combo (Module 11)
│   │   │   └── status/page.tsx     # Theo dõi đơn, gọi NV, thanh toán, VAT
│   │   ├── staff/                  # Module 2 (Nhân viên) — cần đăng nhập role staff/admin
│   │   │   ├── layout.tsx          # StaffNav (tên/role/đăng xuất/ShiftControl — Module 8) + useStaffAlerts
│   │   │   ├── kds/page.tsx        # Màn hình bếp/pha chế (KDS), realtime FIFO
│   │   │   ├── tables/
│   │   │   │   ├── page.tsx        # Lưới 15 bàn + chi tiết + xác nhận thanh toán
│   │   │   │   └── print/page.tsx  # Trang in hoá đơn tạm tính (mở tab riêng)
│   │   │   └── menu-control/page.tsx  # Bật/tắt "Hết món nhanh"
│   │   ├── admin/                  # Module 3 (Chủ quán) — cần đăng nhập role admin
│   │   │   ├── layout.tsx          # AdminNav (tên/role/đăng xuất)
│   │   │   ├── dashboard/page.tsx  # 4 thẻ thống kê + badge cảnh báo kho (Module 6) + Nhận định thông minh (Module 10) + lưới 15 bàn + biểu đồ + best-seller
│   │   │   ├── menu/page.tsx       # CRUD danh mục/món/option
│   │   │   ├── vat-invoices/page.tsx  # Danh sách hoá đơn VAT đã xuất
│   │   │   ├── feedbacks/page.tsx  # (Module 5) Đánh giá khách hàng, realtime
│   │   │   ├── inventory/page.tsx  # (Module 6) Quản lý kho: tồn kho, nhập hàng, công thức món, cấu hình chặn/cảnh báo
│   │   │   ├── shifts/page.tsx     # (Module 8) Lịch sử ca làm việc toàn quán + đối chiếu chênh lệch tiền mặt
│   │   │   ├── promotions/page.tsx # (Module 9) Quản lý khuyến mãi/mã giảm giá + Happy Hour
│   │   │   ├── analytics/page.tsx  # (Module 10) Báo cáo phân tích chi tiết: lọc thời gian, AOV/retention/heatmap/xu hướng tuần, xuất CSV
│   │   │   ├── combos/page.tsx     # (Module 11) Quản lý Combo & Set món ưu đãi: tạo combo, chọn món, giá, bật/tắt hiển thị realtime
│   │   │   └── staff/page.tsx      # (mở rộng Module 4, mục 6.3) Quản lý tài khoản nhân viên: thêm/xoá/đổi role
│   │   └── api/
│   │       ├── print/lan/route.ts     # (Module 5) Route Handler — relay TCP raw ESC/POS tới máy in LAN
│   │       ├── notify/telegram/route.ts  # (Module 7) Route Handler — relay tin nhắn Telegram (giữ TELEGRAM_BOT_TOKEN ở server)
│   │       └── admin/staff/           # (mở rộng Module 4, mục 6.3) Route Handler — tạo/xoá tài khoản qua Supabase Auth Admin API (giữ SUPABASE_SERVICE_ROLE_KEY ở server)
│   │           ├── route.ts               # POST — tạo tài khoản mới
│   │           └── [id]/route.ts          # DELETE — xoá tài khoản (chặn tự xoá mình + xoá admin cuối cùng)
│   ├── components/
│   │   ├── ui/                     # Shadcn primitives (button, sheet, tabs, dialog, switch, select...)
│   │   ├── auth/LoginForm.tsx      # (Module 4) Form đăng nhập
│   │   ├── customer/                # Component nghiệp vụ Module 1 (+ PhoneLookupCard, LoyaltyWidget, FeedbackForm — Module 5) + CouponSection (Module 9) + ComboSection/ComboCard/ComboDetailSheet/ComboCartCard (Module 11)
│   │   ├── staff/                    # Component nghiệp vụ Module 2 (+ PrinterSettingsDialog — Module 5) + ShiftControl/StartShiftDialog/EndShiftDialog/ShiftSummaryCard (Module 8)
│   │   ├── admin/                    # Component nghiệp vụ Module 3 (StatCard, RevenueChart, BestSellerTable, CategoryFormDialog, MenuItemFormSheet, VatInvoiceTable...) + FeedbackList (Module 5) + IngredientFormDialog/RestockDialog/IngredientTable/RecipeEditor (Module 6) + ShiftsTable/ShiftDetailDialog (Module 8) + PromotionsTable/PromotionFormDialog (Module 9) + SmartInsightsCard/AnalyticsFilterBar/WeekdayRevenueChart/HourlyHeatmap/TopItemsTable (Module 10) + CombosTable/ComboFormDialog (Module 11) + StaffAccountsTable/StaffAccountFormDialog (mở rộng Module 4, mục 6.3)
│   │   └── shared/                  # Component dùng chung nhiều module (+ LogoutButton — Module 4)
│   ├── contexts/
│   │   ├── TableContext.tsx        # Xác định bàn từ ?table= hoặc localStorage
│   │   ├── CartContext.tsx         # Giỏ hàng, lưu localStorage theo từng bàn
│   │   └── CustomerContext.tsx     # (Module 5) Danh tính khách hàng thân thiết, lưu localStorage theo từng bàn
│   ├── hooks/
│   │   ├── useMenu.ts              # Tải + realtime is_available của menu_items + refetch() (Module 3 dùng sau khi CRUD)
│   │   ├── useActiveOrders.ts      # (Module 1) đơn + trạng thái món của 1 bàn
│   │   ├── useStationQueue.ts      # (Module 2) hàng đợi KDS theo trạm, realtime
│   │   ├── useTables.ts            # (Module 2 & 3) lưới bàn + đơn + staff_calls, realtime — Dashboard dùng lại nguyên hook này
│   │   ├── useStaffCalls.ts        # (Module 2) danh sách yêu cầu hỗ trợ đang chờ
│   │   ├── useStaffAlerts.ts       # (Module 2) chuông/rung khi có đơn mới / yêu cầu mới
│   │   ├── useNow.ts               # Đồng hồ tick để tính thời gian chờ món (KDS)
│   │   ├── useDashboardSummary.ts  # (Module 3) 4 số liệu thống kê đầu Dashboard, realtime
│   │   ├── useRevenueSeries.ts     # (Module 3) dữ liệu biểu đồ doanh thu theo giờ/ngày
│   │   ├── useBestSellers.ts       # (Module 3) bảng xếp hạng món bán chạy
│   │   ├── useVatInvoices.ts       # (Module 3) danh sách hoá đơn VAT + refetch()
│   │   ├── useCurrentProfile.ts    # (Module 4) user + role đang đăng nhập, cho header/logout
│   │   ├── useStaffAccounts.ts     # (mở rộng Module 4, mục 6.3) danh sách toàn bộ tài khoản, realtime + refetch() — dùng cho /admin/staff
│   │   ├── useFeedbacks.ts         # (Module 5) danh sách đánh giá, realtime
│   │   ├── useIngredients.ts       # (Module 6) danh sách nguyên liệu, realtime + refetch()
│   │   ├── useLowStockIngredients.ts  # (Module 6) nguyên liệu sắp/đã hết — dùng cho badge Dashboard
│   │   ├── useShopSettings.ts      # (Module 6) cấu hình chặn/cho phép khi thiếu nguyên liệu
│   │   ├── useAdminAlerts.ts       # (Module 7) chuông/rung/toast toàn cục khu vực /admin khi có đánh giá mới
│   │   ├── useActiveShift.ts       # (Module 8) ca đang mở của nhân viên hiện đăng nhập + refetch()
│   │   ├── useShiftHistory.ts      # (Module 8) lịch sử ca toàn quán, realtime — dùng cho /admin/shifts
│   │   ├── usePromotions.ts        # (Module 9) danh sách khuyến mãi toàn quán, realtime — dùng cho /admin/promotions
│   │   ├── useAnalyticsReport.ts   # (Module 10) báo cáo phân tích chi tiết theo khoảng thời gian — dùng cho /admin/analytics
│   │   ├── useSmartInsights.ts     # (Module 10) nhận định thông minh (rules-based) — dùng cho Nhận định thông minh ở Dashboard
│   │   ├── useCombos.ts            # (Module 11) danh sách combo ĐANG hiển thị, realtime — dùng cho mục "Combo Tiết Kiệm" ở /order
│   │   └── useAdminCombos.ts       # (Module 11) toàn bộ combo (kể cả đã tắt), realtime — dùng cho /admin/combos
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Supabase client trình duyệt (createBrowserClient — lưu session vào cookie)
│   │   │   ├── middleware.ts       # (Module 4) updateSession() — xác thực + chặn route trong middleware.ts
│   │   │   ├── server.ts           # (Module 5) Supabase client cho Route Handlers (/api/**) — xác thực qua cookie phía server + requireAdmin()/getCurrentUserId() (mở rộng Module 4, mục 6.3)
│   │   │   └── admin.ts            # (mở rộng Module 4, mục 6.3) Supabase client dùng SUPABASE_SERVICE_ROLE_KEY — CHỈ import trong Route Handler, không bao giờ vào code "use client"
│   │   ├── utils.ts                # cn(), formatCurrency(), storage keys, VAT_RATE/estimateVatAmount (Module 3)
│   │   ├── vietqr.ts               # Tạo URL ảnh VietQR (dùng chung Module 1 & 2)
│   │   ├── notify.ts               # Âm thanh bíp + rung cho nhân viên (Module 2), rung nhẹ cho khách hàng (Module 7)
│   │   ├── loyalty.ts              # (Module 5) calculatePointsEarned() — 10.000đ = 1 điểm
│   │   ├── escpos.ts               # (Module 5) Bộ dựng lệnh ESC/POS cho hoá đơn nhiệt 80mm
│   │   ├── printerSettings.ts      # (Module 5) Cấu hình máy in lưu localStorage theo thiết bị
│   │   ├── shifts.ts               # (Module 8) calculateExpectedHandover/calculateCashDiscrepancy — dùng chung staff + admin
│   │   ├── promotions.ts           # (Module 9) normalizePromoCode/formatDiscountLabel/previewPromotionDiscount — dùng chung giỏ hàng + admin
│   │   ├── analytics.ts            # (Module 10) resolveAnalyticsRange/getWeekComparisonRanges/computePercentChange/findPeakTwoHourWindow — tính toán thuần, không gọi Supabase
│   │   └── csv.ts                  # (Module 10) buildCsv/downloadCsv — xuất file CSV phía trình duyệt, không cần thư viện ngoài
│   ├── services/                   # Toàn bộ lời gọi Supabase, tách khỏi UI
│   │   ├── table.service.ts        # + getAllTables, getTableById, subscribeToTableChanges
│   │   ├── menu.service.ts         # + setMenuItemAvailability (hết món nhanh) + CRUD danh mục/món/option (Module 3)
│   │   ├── order.service.ts        # + getStationQueue (nay kèm combo_name — Module 11), updateOrderItemStatus (nay trừ kho khi chuyển 'preparing' — Module 6), markOrdersPaid (nay tự cộng điểm + gắn shift_id, trả về {shiftId} — Module 8), createOrder (nay redeem khuyến mãi trước khi tạo đơn, trả về {order, discountApplied} — Module 9; nay gắn combo_id/combo_group_id/combo_name cho dòng nổ ra từ combo — Module 11), getLatestCompletedOrder (Module 5), báo Telegram khi có đơn mới (Module 7)
│   │   ├── staffCall.service.ts    # + getPendingStaffCalls, resolveStaffCall, subscribeToNewStaffCalls, báo Telegram khi khách gọi NV (Module 7)
│   │   ├── vatInvoice.service.ts   # + getAllVatInvoices (Module 3), getVatInvoiceForOrder (Module 5)
│   │   ├── analytics.service.ts    # (Module 3) getDashboardSummary, getRevenueSeries, getBestSellers + (Module 10) getAnalyticsReport, getSmartInsights
│   │   ├── auth.service.ts         # (Module 4) signInWithPassword, signOut, getCurrentProfile
│   │   ├── customer.service.ts     # (Module 5) findOrCreateCustomerByPhone, getLoyaltyHistory
│   │   ├── loyalty.service.ts      # (Module 5) awardLoyaltyPoints — gọi RPC award_loyalty_points
│   │   ├── feedback.service.ts     # (Module 5) submitFeedback (nay báo Telegram — Module 7), getAllFeedbacks, subscribeToNewFeedbacks(Alert)
│   │   ├── print.service.ts        # (Module 5) buildReceiptData, printReceiptDirect (LAN/Bluetooth)
│   │   ├── inventory.service.ts    # (Module 6) CRUD nguyên liệu/công thức, restockIngredient, checkAndDeductInventoryForOrderItem, cấu hình kho
│   │   ├── telegram.service.ts     # (Module 7) notifyNewOrderTelegram/notifyStaffCallTelegram/notifyNewFeedbackTelegram — fire-and-forget, gọi /api/notify/telegram
│   │   ├── shift.service.ts        # (Module 8) getActiveShiftForCurrentStaff, startShift, closeShift (RPC close_shift), getShiftHistory, subscribeToShiftChanges
│   │   ├── promotion.service.ts    # (Module 9) findPromotionByCode, getAutoApplicablePromotions, redeemPromotion/releasePromotionUsage (RPC), CRUD quản trị + subscribeToPromotionChanges
│   │   ├── combo.service.ts        # (Module 11) getActiveCombosWithItems/getAllCombosWithItems, saveCombo (upsert combo + replace-all combo_items), setComboActive, deleteCombo, subscribeToComboChanges
│   │   └── staff.service.ts        # (mở rộng Module 4, mục 6.3) getAllStaffAccounts, createStaffAccount/deleteStaffAccount (gọi Route Handler /api/admin/staff), updateStaffRole (UPDATE trực tiếp qua RLS, tự chặn đổi role chính mình), subscribeToStaffAccountChanges
│   └── types/
│       ├── database.types.ts       # Khớp 1:1 schema Postgres + ProfilesRow (Module 4) + Customers/LoyaltyTransactions/Feedbacks (Module 5) + Ingredients/RecipeItems/ShopSettings (Module 6) + Shifts/CloseShiftResultRow (Module 8) + Promotions (Module 9) + Combos/ComboItems (Module 11)
│       ├── web-bluetooth.d.ts      # (Module 5) Khai báo tối giản Web Bluetooth API
│       └── index.ts                # Domain types + label maps + kiểu dữ liệu Module 3/4/5/6/7/8/9/10/11 + StaffAccountFormInput (mở rộng Module 4, mục 6.3)
├── supabase/schema.sql             # DDL + RLS policy (đã bổ sung profiles + role-based RLS cho Module 4, customers/loyalty_transactions/feedbacks cho Module 5, ingredients/recipe_items/shop_settings cho Module 6, shifts + RPC close_shift cho Module 8, promotions + RPC redeem_promotion/release_promotion_usage cho Module 9, combos/combo_items + 3 cột combo_id/combo_group_id/combo_name trên order_items cho Module 11, 2 policy "Admin read/update profiles" cho mục 6.3) — Module 7 và Module 10 KHÔNG đổi schema (chỉ đọc dữ liệu có sẵn)
├── .env.local.example              # đổi tên thành .env.local rồi điền key
└── package.json
```

## 2. Cài đặt

```bash
npm install
cp .env.local.example .env.local   # điền URL/anon key Supabase + thông tin VietQR + (tuỳ chọn) Telegram
npm run dev
```

**Từ bản cập nhật UI quản lý tài khoản nhân viên** (mở rộng Module 4, mục 6.3),
`.env.local` cần thêm biến **`SUPABASE_SERVICE_ROLE_KEY`** (lấy ở Supabase
Dashboard → Project Settings → API → mục "service_role", **khác** với "anon
public" key) — dùng ở server để tạo/xoá tài khoản đăng nhập từ trang
`/admin/staff`. Đây là secret có quyền bỏ qua toàn bộ RLS, tuyệt đối không
thêm tiền tố `NEXT_PUBLIC_`, không commit giá trị thật, xem ghi chú chi tiết
trong `.env.local.example`. Không điền biến này thì các trang khác vẫn chạy
bình thường, chỉ riêng `/admin/staff` báo lỗi khi thêm/xoá tài khoản.

Chạy `supabase/schema.sql` trong SQL Editor của dự án Supabase trước (kể cả khi
đã chạy ở bước trước — từ Module 4 trở đi, mọi policy đều có kèm
`drop policy if exists` nên **chạy lại toàn bộ file nhiều lần là an toàn**,
không còn báo lỗi "already exists" như các bản trước nữa). Bật Realtime cho
`tables`, `menu_items`, `orders`, `order_items`, `staff_calls`.

Module 3 thêm 2 gói vào `package.json`: `recharts` (biểu đồ doanh thu) và
`@radix-ui/react-select` (dropdown chọn danh mục/khu vực chế biến). Module 4
thêm `@supabase/ssr` (bắt buộc để `middleware.ts` đọc được phiên đăng nhập từ
cookie) — nhớ `npm install` lại sau khi kéo code mới. **Module 5 KHÔNG thêm
gói nào mới** — in nhiệt (ESC/POS builder + Web Bluetooth) và route in LAN đều
viết tay bằng API sẵn có của trình duyệt/Node.js (`net` module).

Bật thêm Realtime cho bảng `feedbacks` (để `/admin/feedbacks` cập nhật tức
thời):

```sql
alter publication supabase_realtime add table feedbacks;
```

**Module 6 KHÔNG thêm gói npm nào mới.** Bật thêm Realtime cho bảng
`ingredients` (để badge cảnh báo trên Dashboard và trang `/admin/inventory`
tự cập nhật ngay khi KDS trừ kho):

```sql
alter publication supabase_realtime add table ingredients;
```

**Module 7 KHÔNG thêm gói npm nào mới và KHÔNG đổi `schema.sql`** — toàn bộ
hiệu ứng UI dùng lại đúng các kênh Realtime đã bật ở trên, và Telegram Bot
gọi thẳng `https://api.telegram.org` bằng `fetch()` có sẵn của Node.js. Chỉ
cần điền thêm 2 biến **tuỳ chọn** vào `.env.local` nếu muốn bật báo cáo
Telegram (bỏ trống thì tính năng tự tắt, không lỗi gì):

```bash
TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=-1001234567890
```

Cách lấy: chat với [@BotFather](https://t.me/BotFather) trên Telegram để tạo
bot mới (lệnh `/newbot`) và lấy `TELEGRAM_BOT_TOKEN`; thêm bot vừa tạo vào
group Telegram của quán, gửi thử 1 tin nhắn bất kỳ trong group đó, rồi mở
`https://api.telegram.org/bot<TOKEN>/getUpdates` trên trình duyệt để đọc
`chat.id` (số âm, dạng `-100...` với group/supergroup) — đó chính là
`TELEGRAM_CHAT_ID`.

**Tạo tài khoản chủ quán ĐẦU TIÊN** (không có trang đăng ký công khai — bắt
buộc làm thủ công 1 lần duy nhất, vì trang `/admin/staff` ở mục 6.3 cần sẵn
1 tài khoản `admin` để đăng nhập vào mới dùng được):
1. Supabase Dashboard → Authentication → Users → **Add user** → nhập
   email/mật khẩu, tick **Auto Confirm User** (nếu không tick, phải tắt
   "Confirm email" ở Authentication → Settings, nếu không tài khoản sẽ không
   đăng nhập được cho đến khi xác nhận email).
2. Trigger có sẵn trong `schema.sql` sẽ tự tạo 1 dòng trong bảng `profiles`
   với `role = 'staff'`.
3. Để cấp quyền **chủ quán** cho tài khoản đó, chạy trong SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'chuquan@vidu.com';
   ```

Từ tài khoản chủ quán này, **mọi tài khoản khác** (thêm nhân viên mới, đổi
role, xoá tài khoản) tạo/quản lý trực tiếp trong app qua trang
`/admin/staff` — xem mục 6.3, không cần vào Supabase Dashboard nữa.

## 3. Luồng khách hàng (Module 1)

1. Quét QR tại bàn → mở `/?table=5` → tự chuyển sang `/order?table=5`.
2. Xem thực đơn theo danh mục, món hết hàng cập nhật realtime.
3. Chọn topping/ghi chú/số lượng → giỏ hàng (localStorage theo bàn) → gửi đơn.
4. Theo dõi trạng thái từng món realtime, gọi nhân viên, thanh toán VietQR, xuất VAT.

## 4. Luồng nhân viên (Module 2)

### 4.1 KDS — `/staff/kds`
Hai tab **Quầy Bar** / **Quầy Bếp**, lọc theo `order_items.station_type` (đã lưu
sẵn từ lúc khách đặt món ở Module 1, không cần join `menu_items` để lọc trạm).
Mỗi thẻ món hiển thị số bàn, tên món, số lượng, ghi chú/topping và thời gian
chờ (tự cập nhật mỗi 15s qua `useNow`). Thẻ chuyển sang viền/nền **vàng** khi
≥ `KDS_WARN_MINUTES` (10 phút) và **đỏ** khi ≥ `KDS_DANGER_MINUTES` (15 phút)
— hai ngưỡng này khai báo ở `types/index.ts`, chỉnh một chỗ áp dụng toàn bộ.
Bấm nút trên thẻ để chuyển `pending → preparing → ready → served` (mỗi lần bấm
đi 1 bước, món biến mất khỏi hàng đợi khi đã `served`). Toàn bộ realtime qua
Postgres Changes trên `order_items`.

**Quan trọng**: khi món chuyển `served`, hệ thống **không** tự động đổi
`orders.status` thành `completed` — việc đó chỉ xảy ra khi nhân viên xác nhận
thanh toán (mục 4.2), để tránh đơn "biến mất" khỏi các bộ lọc trong khi khách
chưa trả tiền.

### 4.2 Quản lý bàn & Thanh toán — `/staff/tables`
Lưới toàn bộ bàn với 3 trạng thái theo đúng enum có sẵn: **Trống** (`empty`),
**Đang gọi món** (`ordering`), **Chờ thanh toán** (`paid` — dùng lại giá trị
enum `paid` cho ý nghĩa "khách đang yêu cầu thanh toán / nhân viên đang xử
lý", KHÔNG phải "đã thanh toán xong"; bàn chỉ thật sự trống trở lại khi nhân
viên bấm "Xác nhận đã thu tiền"). Bàn có yêu cầu hỗ trợ đang chờ (gọi nhân
viên/xin đá/yêu cầu thanh toán từ `staff_calls`) hiện chuông đỏ góc thẻ.
Bấm vào 1 bàn để xem chi tiết đơn, xử lý yêu cầu hỗ trợ, **In tạm tính** (mở
tab riêng `/staff/tables/print?table=<id>`, tự động gọi `window.print()` —
đây là hoá đơn dùng hộp thoại in của trình duyệt, phù hợp máy in thường; nếu
quán dùng máy in nhiệt POS chuyên dụng cần driver riêng, ngoài phạm vi một
web app thuần Next.js) hoặc **Xác nhận thanh toán** (chọn tiền mặt/VietQR, ghi
`payment_status='paid'`, `status='completed'` cho mọi đơn của bàn, rồi trả bàn
về `empty`).

### 4.3 Hết món nhanh — `/staff/menu-control`
Tái sử dụng nguyên `useMenu()` của Module 1 (đã có sẵn cấu trúc category →
items và realtime `is_available`) — chỉ thêm `setMenuItemAvailability()` để
bật/tắt. Vì Module 1 đã lắng nghe realtime trên `menu_items`, khách hàng đang
xem thực đơn thấy thay đổi ngay lập tức mà không cần thêm hạ tầng mới.

### 4.4 Cảnh báo chuông/rung
`useStaffAlerts()` (gắn 1 lần ở `staff/layout.tsx`) lắng nghe **INSERT** trên
`orders` (đơn mới) và `staff_calls` (yêu cầu mới), phát tiếng bíp bằng Web
Audio API (không cần file âm thanh) + rung bằng Vibration API + toast — hoạt
động trên mọi trang con của `/staff`.

Mọi lỗi gọi Supabase đều được bắt và hiển thị qua toast (`sonner`) bằng thông
điệp tiếng Việt dễ hiểu, không rò rỉ lỗi kỹ thuật ra UI.

## 5. Luồng chủ quán (Module 3)

Tối ưu cho màn hình PC/Tablet (layout `max-w-7xl`, không giới hạn hẹp như
`/staff`). Điều hướng qua `AdminNav`: Tổng quan / Quản lý menu / Hoá đơn VAT.

### 5.1 Tổng quan — `/admin/dashboard`
4 thẻ thống kê đầu trang: doanh thu hôm nay (chỉ tính đơn `payment_status =
'paid'`, khớp cách tính ở biểu đồ doanh thu để không lệch số liệu), số đơn
hôm nay, số hoá đơn VAT đã xuất hôm nay, và thẻ tổng quan 15 bàn (đếm theo 3
trạng thái). Bên dưới là **lưới 15 bàn realtime dùng lại nguyên** `useTables()`
+ `TableCard` + `TableDetailSheet` + `PaymentConfirmSheet` của Module 2 — chủ
quán xem/xử lý y hệt màn hình nhân viên, không viết lại logic bàn/thanh toán.
Cuối trang là biểu đồ doanh thu và bảng xếp hạng món bán chạy (xem 5.2).

### 5.2 Biểu đồ & thống kê
- **Biểu đồ doanh thu** (`RevenueChart`, dùng Recharts): cột theo giờ (hôm
  nay, khung 6h–22h) hoặc theo ngày (7 ngày qua), 1 chuỗi số liệu duy nhất nên
  dùng đúng 1 tông màu thương hiệu (`#8b491d`, quy đổi từ `--primary`), không
  dùng thang màu nhiều tông. Có nút chuyển sang **dạng bảng** để đảm bảo mọi
  giá trị đọc được kể cả khi không hover được (tablet cảm ứng).
- **Bảng xếp hạng món bán chạy** (`BestSellerTable`): xếp theo tổng
  `quantity` trong `order_items` (toàn bộ lịch sử), kèm cột doanh thu ước
  tính. **Lưu ý**: `order_items` không lưu đơn giá tại thời điểm đặt (đúng
  theo schema gốc), nên doanh thu ở bảng này tính theo **giá món hiện tại**,
  chỉ mang tính tham khảo — khác với doanh thu ở thẻ thống kê/biểu đồ vốn lấy
  thẳng từ `orders.total_amount` đã chốt lúc tạo đơn (chính xác).

### 5.3 Quản lý menu — `/admin/menu`
CRUD đầy đủ: thêm/sửa/xoá danh mục (đổi tên + thứ tự hiển thị), thêm/sửa/xoá
món (tên, giá, ảnh, đổi danh mục, đổi `station_type` Bar/Bếp, bật/tắt còn
hàng), thêm/sửa/xoá topping/option theo từng món. Dùng lại nguyên `useMenu()`
của Module 1 (thêm `refetch()`) — mọi thao tác ghi xong gọi `refetch()` để
đồng bộ lại cây danh mục, khách hàng đang xem menu vẫn thấy `is_available`
cập nhật realtime như cũ. **Xoá danh mục sẽ CASCADE xoá toàn bộ món + option
bên trong** — có hộp thoại xác nhận trước khi xoá; xoá món KHÔNG cascade
`order_items` cũ (giữ lịch sử đơn hàng), nên với món đã từng bán nên tắt "còn
hàng" thay vì xoá hẳn.

### 5.4 Hoá đơn VAT — `/admin/vat-invoices`
Danh sách toàn bộ hoá đơn VAT đã xuất (mới nhất trước), kèm tổng tiền đơn
hàng gốc và số bàn. Bấm 1 dòng để xem chi tiết công ty/mã số thuế/địa
chỉ/email. **Lưu ý quan trọng**: schema `vat_invoices` (theo đúng yêu cầu
gốc) không lưu thuế suất/số tiền thuế riêng — chỉ lưu thông tin công ty để
xuất hoá đơn ngoài hệ thống kế toán. Cột "Tiền VAT" ở đây là **số tạm tính**
(giả định `total_amount` đã bao gồm thuế, tách theo `VAT_RATE` khai báo ở
`lib/utils.ts`, mặc định 8%) — đổi hằng số đó nếu quán áp dụng thuế suất
khác, đây không phải số liệu đã chốt trên hoá đơn thực.

Mọi lỗi gọi Supabase đều được bắt và hiển thị qua toast (`sonner`) bằng thông
điệp tiếng Việt dễ hiểu, không rò rỉ lỗi kỹ thuật ra UI — áp dụng nhất quán ở
cả 3 module.

## 6. Auth & phân quyền (Module 4)

### 6.1 Kiến trúc
- **Supabase Auth (Email/Password)** cho tài khoản nội bộ. Không có trang
  đăng ký công khai — xem "Tạo tài khoản nhân viên/chủ quán đầu tiên" ở mục 2.
- **Bảng `profiles`** (`id` khớp `auth.users.id`, `role` = `'admin' | 'staff'`)
  lưu vai trò. Hàm `public.current_user_role()` (SECURITY DEFINER) đọc role
  của người đang đăng nhập, dùng trong hầu hết các policy RLS mới.
- **`src/lib/supabase/client.ts`** chuyển từ `createClient` sang
  `createBrowserClient` (gói `@supabase/ssr`) để phiên đăng nhập được lưu vào
  **cookie** thay vì chỉ localStorage — bắt buộc để middleware (chạy ở
  server/edge) đọc được phiên đăng nhập.
- **`src/middleware.ts`** + **`src/lib/supabase/middleware.ts`**: chặn mọi
  request tới `/staff/*` và `/admin/*`. Dùng `supabase.auth.getUser()` (xác
  thực lại token với Supabase Auth server, KHÔNG dùng `getSession()` vốn chỉ
  đọc cookie tại chỗ và có thể bị giả mạo). Logic:
  - Chưa đăng nhập → redirect `/login?redirect=<đường-dẫn-gốc>`.
  - Đã đăng nhập nhưng không có `profiles.role` hợp lệ → `/login?error=no-role`.
  - `role='staff'` cố vào `/admin/*` → redirect về `/staff/tables`.
  - `role='admin'` được vào **cả hai** khu vực (chủ quán bao trùm quyền nhân viên).
- **`/login`** (`LoginForm.tsx`): form email/mật khẩu, đăng nhập xong tự tải
  `profiles.role` để điều hướng đúng khu vực (hoặc theo `?redirect=` nếu có),
  báo lỗi qua toast tiếng Việt khi sai thông tin.
- **Đăng xuất**: `LogoutButton` (dùng chung, `components/shared/`) đặt trên
  `StaffNav`/`AdminNav`, gọi `useCurrentProfile().signOut()` → xoá session →
  điều hướng về `/login`.
- **Token tự động đính kèm**: mọi `services/*.ts` đều gọi qua singleton
  `supabase` client — sau khi đăng nhập, `supabase-js` tự gắn access token
  của phiên hiện tại vào MỌI request tiếp theo (kể cả trong tab/thiết bị
  khác đã đăng nhập cùng tài khoản), không cần sửa gì ở tầng service.

### 6.2 RLS theo vai trò (điểm quan trọng nhất của bản cập nhật này)
Trước Module 4, `/staff` và `/admin` dùng CHUNG anon key với khách — ai có
key (lộ sẵn trong code phía trình duyệt) cũng gọi thẳng được các thao tác
quản trị. Từ Module 4, `supabase/schema.sql` tách rõ 2 phía:

| Bảng | Khách (anon) | Nhân viên/Chủ quán (authenticated) |
|---|---|---|
| `categories`, `menu_items`, `item_options` | Chỉ đọc | `menu_items` UPDATE: cả 2 role (bật/tắt hết món + sửa toàn bộ); INSERT/DELETE + toàn bộ CRUD `categories`/`item_options`: **chỉ `admin`** |
| `orders` | Tạo đơn + tự đổi `payment_method` **khi đơn chưa thanh toán** (`with check` chặn chuyển `payment_status`/`status`) | Xác nhận thanh toán (`payment_status`, `status`): `admin`/`staff` |
| `order_items` | Tạo món + đọc | Đổi `item_status` (KDS): `admin`/`staff` |
| `tables` | Chỉ được set `'ordering'` (`with check`) | Mọi trạng thái khác (đặc biệt trả bàn về `'empty'`): `admin`/`staff` |
| `staff_calls` | Chỉ tạo (gửi yêu cầu) | Đọc danh sách + đánh dấu đã xử lý: `admin`/`staff` |
| `vat_invoices` | Chỉ tạo (gửi yêu cầu lúc thanh toán) | Đọc danh sách/số liệu: **chỉ `admin`** |
| `profiles` | Không truy cập được | Mỗi user đọc hồ sơ của chính mình; **`admin`** đọc/sửa (đổi `role`) TOÀN BỘ hồ sơ (2 policy cộng thêm, mục 6.3) |

Kỹ thuật dùng cho `orders`/`tables`: **2 policy permissive cho cùng 1 lệnh
UPDATE**, Postgres sẽ OR các điều kiện `WITH CHECK` lại với nhau — khách được
phép update NHƯNG chỉ khi giá trị mới vẫn nằm trong tập "chưa thanh
toán"/`'ordering'`; nhân viên/chủ quán có policy riêng không bị ràng buộc đó.
Nhờ vậy một khách rành kỹ thuật gọi thẳng Supabase API cũng không thể tự đánh
dấu đơn đã trả tiền hay trả bàn về trống.

**Giới hạn đã biết**: RLS ở mức DÒNG không phân biệt được CỘT nào đang bị sửa,
nên `menu_items` UPDATE cho phép cả `staff` lẫn `admin` (không tách được
"staff chỉ được bật/tắt còn hàng, không được sửa giá") — muốn chặn chặt hơn
cần column privileges hoặc trigger kiểm tra cột thay đổi, ngoài phạm vi bản
cập nhật này.

### 6.3 Quản lý tài khoản nhân viên — `/admin/staff` (mở rộng Module 4)

Trang `/admin/staff` (chỉ `admin` truy cập được, chặn bởi middleware như mọi
trang `/admin/*` khác) thay thế hoàn toàn thao tác thủ công qua Supabase
Dashboard/SQL Editor: **thêm tài khoản mới, đổi vai trò, xoá tài khoản** —
đúng 3 việc, không có sửa tên/đổi mật khẩu (nằm ngoài phạm vi hiện tại).

- **Thêm tài khoản** (`StaffAccountFormDialog.tsx`) cần email + mật khẩu tạm
  (≥ 6 ký tự) + vai trò. Gửi `POST /api/admin/staff` — Route Handler này
  dùng **Supabase Auth Admin API** (`auth.admin.createUser`, cần
  `SUPABASE_SERVICE_ROLE_KEY`, xem `src/lib/supabase/admin.ts`) với
  `email_confirm: true` nên tài khoản mới **đăng nhập được ngay**, không cần
  bước "Auto Confirm User" thủ công như tài khoản đầu tiên ở mục 2. Trigger
  `handle_new_user()` tự tạo dòng `profiles` (`role='staff'` mặc định), Route
  Handler `UPDATE` tiếp theo set đúng `role`/`full_name` đã chọn.
- **Đổi vai trò** (`StaffAccountsTable.tsx`, `Select` inline ngay trong bảng)
  là `UPDATE public.profiles.role` bình thường qua RLS — 2 policy mới
  "Admin read profiles"/"Admin update profiles" trong `schema.sql` (permissive,
  CỘNG THÊM vào "Users read own profile" chứ không thay thế) cho phép `admin`
  đọc/sửa hồ sơ người khác mà không cần Route Handler riêng.
- **Xoá tài khoản** gửi `DELETE /api/admin/staff/[id]`, cũng dùng Auth Admin
  API (`auth.admin.deleteUser`) — nhờ `profiles.id references auth.users(id)
  on delete cascade` có sẵn từ Module 4, dòng `profiles` tự xoá theo, không
  cần dọn riêng.
- **Chặn tự khoá mình khỏi `/admin`**: không cho tự đổi role hay tự xoá chính
  tài khoản đang đăng nhập (badge "Bạn" + control bị vô hiệu hoá trên đúng
  dòng đó). Đổi role tự chặn ở phía client (`staff.service.ts`, **không phải**
  ranh giới bảo mật cứng — giống cách subtotal client-side ở Module 9). Xoá
  tài khoản chặn cứng ở server (Route Handler): không cho tự xoá chính mình,
  và không cho xoá **`admin` cuối cùng** (đếm số `admin` còn lại trước khi
  xoá) — vì thao tác xoá không thể hoàn tác.

**Yêu cầu môi trường**: cần điền `SUPABASE_SERVICE_ROLE_KEY` trong
`.env.local` (mục 2) và chạy lại `supabase/schema.sql` để có 2 policy RLS mới
nói trên — thiếu 1 trong 2 thì trang `/admin/staff` báo lỗi khi thêm/xoá tài
khoản (đổi role vẫn chạy được nếu chỉ thiếu service role key, vì phần đó
không đi qua Route Handler).

## 7. Quy ước tái sử dụng chung (áp dụng cho mọi module, kể cả mở rộng sau này)

- **Không viết thêm Supabase call trực tiếp trong component** — luôn thêm hàm
  mới vào `services/*.ts` tương ứng.
- **Không dùng `any`** — nếu Supabase trả kiểu chưa khớp (đặc biệt với các
  select có embed quan hệ như `order:orders(table:tables(...))`), ép kiểu
  tường minh một lần bằng kiểu `Raw...`/`unknown` ngay trong service, xem ví
  dụ ở `getStationQueue`/`getPendingStaffCalls`/`getAllVatInvoices` — không để
  `any` rò ra ngoài.
- Trạng thái bàn/đơn/khu vực chế biến dùng chung enum trong
  `database.types.ts`; nhãn hiển thị tiếng Việt (label maps) đặt tại
  `types/index.ts` (`TABLE_STATUS_LABEL`, `ORDER_ITEM_STATUS_LABEL`,
  `STAFF_CALL_LABEL`, `STATION_TYPE_LABEL`) — import lại, không định nghĩa
  nhãn mới rải rác trong component.
- Realtime: mỗi service export riêng hàm `subscribeToX(...)` trả về
  `RealtimeChannel` để component tự `unsubscribe()` trong cleanup của
  `useEffect`, tránh rò rỉ kết nối khi có nhiều tablet/PC cùng mở KDS/Dashboard.
- VietQR: dùng chung `lib/vietqr.ts`, không tự viết lại logic build URL.
- Danh sách 15 bàn realtime (`useTables()` + `TableCard` + `TableDetailSheet`
  + `PaymentConfirmSheet`) đã dùng chung giữa Module 2 và 3 — mọi màn hình cần
  xem/thao tác trên bàn ở tương lai nên tái sử dụng bộ này thay vì viết mới.

## 8. Vận hành nâng cao (Module 5)

### 8.1 In hoá đơn nhiệt trực tiếp

Thay `window.print()` (vẫn giữ lại làm phương án dự phòng — nút nhỏ "In qua
hộp thoại trình duyệt" trong `TableDetailSheet`) bằng in trực tiếp, không qua
hộp thoại của trình duyệt:

- `lib/escpos.ts`: bộ dựng lệnh ESC/POS thuần TypeScript (không phụ thuộc
  Node) — dùng chung cho cả 2 đường in bên dưới vì cả hai chỉ cần 1
  `Uint8Array`.
- **In qua mạng LAN** (mặc định, cổng 9100): trình duyệt KHÔNG thể tự mở raw
  TCP socket tới máy in — route `POST /api/print/lan` (Node.js runtime, dùng
  module `net`) đóng vai trò cầu nối. **Route này CHỈ hoạt động khi server
  Next.js chạy trong CÙNG mạng LAN với máy in** (self-host tại quán) — deploy
  lên hosting cloud (Vercel...) sẽ luôn timeout vì server không có đường tới
  IP nội bộ của quán. Route có xác thực (`requireStaffOrAdmin`, xem
  `lib/supabase/server.ts`) vì `middleware.ts` không bảo vệ `/api/**`.
- **In qua Web Bluetooth (BLE)**: chỉ hỗ trợ máy in Bluetooth Low Energy thật
  sự — máy in Bluetooth Classic/SPP (rất phổ biến ở dòng giá rẻ) **không kết
  nối được** qua Web Bluetooth (giới hạn của trình duyệt, không phải giới hạn
  của code này). UUID service/characteristic khác nhau tuỳ hãng, cấu hình ở
  nút "Cài đặt máy in" (`PrinterSettingsDialog`, lưu localStorage theo từng
  thiết bị thu ngân).
- **Dấu tiếng Việt**: phần lớn máy in nhiệt giá phổ thông không hỗ trợ UTF-8
  đầy đủ, nên hoá đơn in ra hiện BỎ DẤU (xem `stripDiacritics` trong
  `lib/escpos.ts`) để an toàn — quán có máy in hỗ trợ UTF-8 có thể tự bỏ bước
  này nếu muốn giữ dấu.

### 8.2 Khách hàng thân thiết & Tích điểm

- Bảng `customers` (`phone` UNIQUE làm định danh) + `loyalty_transactions`
  (sổ cái lịch sử tích điểm) + cột `orders.customer_id` (nullable).
- **Không xác thực OTP** (ngoài phạm vi bản cập nhật — không tích hợp SMS):
  biết SĐT là tra được điểm/lịch sử, tương tự đánh đổi "biết `table_id` là
  xem được đơn" đã chấp nhận từ Module 1. Xem chú thích RLS trong
  `schema.sql`.
- Khách nhập SĐT (tuỳ chọn, có thể bỏ qua) ở bước giỏ hàng
  (`PhoneLookupCard`) — tự tra cứu hoặc đăng ký thành viên mới, danh tính lưu
  localStorage **theo từng bàn** (`CustomerContext`, giống `CartContext`) để
  khách mới ngồi vào bàn cũ không kế thừa nhầm điểm của khách trước.
- Cộng điểm **nguyên tử** (10.000đ = 1 điểm, `lib/loyalty.ts`) qua Postgres
  function `award_loyalty_points` (gọi bằng `supabase.rpc`) ngay trong
  `markOrdersPaid()` — tránh race-condition đọc-sửa-ghi nếu 2 lượt thanh toán
  của cùng 1 khách xảy ra gần như đồng thời. Lỗi cộng điểm không làm rollback
  việc xác nhận thanh toán (tiền đã thu là sự thật quan trọng nhất).
- Widget điểm (`LoyaltyWidget`, ở header trang thực đơn) hiện số điểm + lịch
  sử, tự `refresh()` mỗi lần mở để lấy số điểm mới nhất.

### 8.3 Đánh giá sau thanh toán

- Bảng `feedbacks` (1 đánh giá / 1 đơn — `unique(order_id)` chặn spam từ màn
  hình khách).
- `order/status/page.tsx`: khi bàn HẾT đơn đang hoạt động, tự kiểm tra đơn
  `completed` gần nhất của bàn — nếu chưa có feedback, chuyển sang form đánh
  giá nhanh (`FeedbackForm`, 3 hạng mục 1-5 sao + nhận xét tự do); đã có
  feedback thì hiện lời cảm ơn thay vì hiện lại form.
- `/admin/feedbacks`: danh sách đánh giá + điểm trung bình 3 hạng mục, tự cập
  nhật realtime (`useFeedbacks` + `subscribeToNewFeedbacks`) — **chỉ `admin`
  đọc được** (RLS), giống cách `vat_invoices` đã giới hạn từ Module 3.

## 9. Quản lý kho theo công thức (Module 6)

### 9.1 Cơ sở dữ liệu kho & công thức

- **`ingredients`** (`name` UNIQUE, `unit`, `stock_quantity`, `min_threshold`):
  1 dòng / 1 nguyên liệu. `stock_quantity` cho phép **âm** (không có ràng buộc
  `>= 0`) — chủ ý: khi quán TẮT "chặn khi thiếu nguyên liệu" (mục 9.3), hệ
  thống vẫn phải trừ kho đúng số thực đã dùng dù kho không đủ, để số liệu tồn
  kho phản ánh đúng mức âm cần nhập bù, thay vì chặn ở 0 và làm sai lệch lần
  trừ kho tiếp theo.
- **`recipe_items`** (`menu_item_id`, `ingredient_id`, `quantity_required`,
  `unique(menu_item_id, ingredient_id)`): công thức — 1 món gồm nhiều dòng,
  mỗi dòng là định lượng 1 nguyên liệu. Xoá `menu_items`/`ingredients` sẽ
  CASCADE xoá luôn các dòng công thức liên quan.
- **`shop_settings`**: bảng **singleton** (`id boolean primary key default
  true check (id)` — ràng buộc CHECK đảm bảo cột PK chỉ có thể là giá trị
  `true`, nên Postgres không bao giờ cho tồn tại dòng thứ 2), hiện chỉ có 1
  cột cấu hình `block_order_when_insufficient_stock`. Được seed sẵn 1 dòng
  trong `schema.sql` (`insert ... on conflict (id) do nothing`).

### 9.2 Cơ chế trừ kho tự động

- Trừ kho xảy ra tại đúng 1 điểm: khi nhân viên bấm chuyển 1 `order_item` từ
  `pending` sang **`preparing`** ở KDS (`/staff/kds`) — đây là hành động
  "bắt đầu làm món" khớp với yêu cầu gốc, không trừ ở bước tạo đơn (khách có
  thể huỷ trước khi bếp bắt đầu làm) và không trừ theo `preparing → ready`
  (chỉ trừ 1 lần / món).
- `order.service.updateOrderItemStatus()` khi thấy status mới là `preparing`
  sẽ gọi `inventory.service.checkAndDeductInventoryForOrderItem(menuItemId,
  quantity)` **trước khi** ghi `item_status` — nếu quán bật chặn và thiếu
  nguyên liệu, hàm này ném lỗi, `item_status` KHÔNG bị đổi (món vẫn nằm ở
  `pending`, nhân viên thấy toast báo lỗi và có thể thử lại sau khi nhập
  hàng).
- Trừ kho **nguyên tử** bằng 1 câu SQL duy nhất
  (`deduct_inventory_for_order_item`, `UPDATE ... FROM recipe_items`) — trừ
  cùng lúc mọi nguyên liệu trong công thức của món, tránh trừ được nửa chừng
  nếu lỗi giữa chừng như khi loop nhiều lệnh `UPDATE` riêng lẻ.
- Món **chưa khai báo công thức** (ví dụ nước suối đóng chai không cần pha
  chế) → không có gì để trừ, luôn cho qua bình thường.
- **Cấu hình chặn/cảnh báo** (`shop_settings.block_order_when_insufficient_stock`,
  đổi qua switch ở `/admin/inventory`):
  - **Tắt (mặc định)**: luôn cho bếp bấm "Bắt đầu làm", luôn trừ kho (kể cả
    xuống âm), chỉ hiện toast cảnh báo liệt kê tên nguyên liệu thiếu.
  - **Bật**: chặn hẳn — bếp không thể chuyển món sang `preparing` nếu bất kỳ
    nguyên liệu nào trong công thức không đủ số lượng cần dùng.
- **Race nhỏ đã biết**: bước kiểm tra đủ/thiếu (đọc `ingredients` +
  `shop_settings`) và bước trừ kho (RPC atomic) là 2 lượt gọi riêng, nên nếu 2
  đơn cùng món được bấm "Bắt đầu làm" trong cùng khoảnh khắc, thông báo cảnh
  báo hiển thị có thể chưa phản ánh đúng lượt trừ của nhau. Bản thân **số
  liệu tồn kho sau khi trừ luôn đúng** (vì RPC chạy atomic ở tầng Postgres) —
  chỉ ảnh hưởng tới việc toast cảnh báo có bắn ra đúng lúc hay không. Chấp
  nhận được ở quy mô 1 quán 15 bàn.

### 9.3 Quản trị kho & cảnh báo — `/admin/inventory`

- **Danh sách nguyên liệu** (`IngredientTable`): tên, đơn vị, tồn kho (tô đỏ +
  badge "Sắp hết" khi dưới ngưỡng), ngưỡng cảnh báo, và 3 thao tác **Nhập
  kho** / **Sửa** / **Xoá**.
- **Nhập kho** (`RestockDialog`): cộng thêm số lượng vào tồn kho qua RPC
  `adjust_ingredient_stock` (cộng nguyên tử, không đọc-sửa-ghi).
  Sửa nguyên liệu (`IngredientFormDialog`) chỉ đổi tên/đơn vị/ngưỡng — KHÔNG
  cho sửa trực tiếp `stock_quantity` ở đây, để tồn kho chỉ có đúng 2 đường ghi
  (nhập kho qua RPC, trừ kho tự động qua RPC), tránh 2 nơi cùng ghi trực tiếp
  gây sai lệch số liệu.
- **Công thức món** (`RecipeEditor`): chọn 1 món trong menu (dùng lại
  `useMenu()` của Module 1/3), xem/thêm/sửa định lượng/xoá từng dòng nguyên
  liệu trong công thức của món đó.
- **Cấu hình chặn khi thiếu nguyên liệu**: switch bật/tắt hành vi mô tả ở mục
  9.2, lưu vào `shop_settings` (chỉ `admin` được sửa — RLS).
- **Cảnh báo trên Dashboard**: `/admin/dashboard` hiện badge đỏ "N nguyên liệu
  sắp/đã hết hàng" cạnh tiêu đề khi có ít nhất 1 nguyên liệu dưới ngưỡng
  (`useLowStockIngredients`, lọc ở tầng client vì số nguyên liệu của 1 quán
  rất nhỏ, cùng quy ước với `analytics.service.ts`), bấm vào để tới thẳng
  `/admin/inventory`.

### 9.4 RLS

| Bảng | Khách (anon) | Nhân viên (`staff`) | Chủ quán (`admin`) |
|---|---|---|---|
| `ingredients` | Không truy cập | Đọc + sửa (`stock_quantity` qua RPC khi trừ kho tự động) | Đọc + sửa + **thêm/xoá nguyên liệu** |
| `recipe_items` | Không truy cập | Chỉ đọc (KDS cần đọc để tính đủ/thiếu) | Đọc + **toàn bộ CRUD** (soạn công thức) |
| `shop_settings` | Không truy cập | Chỉ đọc | Đọc + **sửa** (bật/tắt chặn) |

Nhân viên cần quyền UPDATE trên `ingredients` vì lệnh trừ kho tự động
(`deduct_inventory_for_order_item`) chạy dưới quyền `security invoker`
(mặc định — giống `award_loyalty_points` ở Module 5) nên vẫn bị RLS của
người gọi RPC (nhân viên đang đăng nhập) chi phối, không phải chạy với
quyền siêu người dùng.

## 10. Thông báo tự động (Module 7)

Hai phần độc lập, có thể dùng riêng: hiệu ứng UI realtime (luôn bật, không
cần cấu hình) và báo cáo qua Telegram (tuỳ chọn, cần điền biến môi trường ở
mục 2).

### 10.1 Hiệu ứng UI realtime ở client

Không thêm hạ tầng mới — tận dụng đúng các kênh Postgres Changes đã có từ
Module 1/2/5, chỉ bổ sung phần "phản hồi trực quan ngay lập tức" còn thiếu:

- **Màn hình khách** (`/order/status`): `useActiveOrders` giờ so sánh
  `item_status` của từng món giữa 2 lần tải để phát hiện món VỪA chuyển sang
  `ready` ("Đã xong") — rung nhẹ (`notifyCustomer()`, chỉ rung, không phát
  âm thanh — khách cầm điện thoại riêng, không cần chuông như màn hình dùng
  chung của nhân viên) + toast "Món ... đã sẵn sàng!" + badge trạng thái của
  món đó tự nhấp nháy (`animate-pulse`) cho tới khi khách xem lại trang.
  Bỏ qua lần tải ĐẦU TIÊN để không báo nhầm cho món vốn đã xong từ trước.
- **KDS** (`/staff/kds`) và **quản lý bàn** (`/staff/tables`): đã có sẵn từ
  Module 2 (`useStaffAlerts`, đặt ở `staff/layout.tsx`) — chuông + rung +
  toast ngay khi có ĐƠN MỚI hoặc YÊU CẦU HỖ TRỢ MỚI, hoạt động trên toàn bộ
  khu vực `/staff` bất kể đang mở trang con nào. Module 7 bổ sung thêm badge
  chuông đỏ ở góc thẻ bàn (`TableCard`) tự nhấp nháy (`animate-pulse`) khi
  bàn có yêu cầu đang chờ, dễ nhận ra hơn giữa lưới 15 bàn.
- **Chủ quán** (`/admin/*`): hook mới `useAdminAlerts` (đặt ở
  `admin/layout.tsx`, mirror đúng mô hình `useStaffAlerts`) — chuông + rung +
  toast ngay khi có ĐÁNH GIÁ MỚI, hoạt động trên toàn bộ khu vực `/admin`
  chứ không chỉ khi đang mở `/admin/feedbacks`. Dùng kênh Realtime RIÊNG
  (`subscribeToNewFeedbacksAlert`, hậu tố `:alert`) tách khỏi kênh
  `subscribeToNewFeedbacks` mà `/admin/feedbacks` dùng để tự refetch danh
  sách — cùng quy ước đã áp dụng cho `orders`/`staff_calls` ở Module 2
  (kênh "báo chuông toàn cục" luôn tách khỏi kênh "1 trang tự làm mới").

### 10.2 Báo cáo qua Telegram Bot

- **Kiến trúc**: `services/telegram.service.ts` (chạy ở BROWSER, trong
  `order.service.createOrder`/`staffCall.service.createStaffCall`/
  `feedback.service.submitFeedback`) gọi `fetch("/api/notify/telegram")` —
  route nội bộ Next.js (`app/api/notify/telegram/route.ts`, Node runtime)
  mới thực sự giữ `TELEGRAM_BOT_TOKEN` và gọi
  `https://api.telegram.org/bot<TOKEN>/sendMessage`. Token KHÔNG bao giờ lộ
  ra bundle trình duyệt vì không có tiền tố `NEXT_PUBLIC_`.
- **Fire-and-forget triệt để**: cả 3 hàm `notify*Telegram()` ở
  `telegram.service.ts` đều KHÔNG trả về Promise cho caller `await` (tự
  `.catch()` lỗi bên trong) — một tin Telegram gửi lỗi/timeout, hoặc quán
  chưa cấu hình bot, không bao giờ được phép làm gián đoạn việc đặt món/gọi
  nhân viên/gửi đánh giá của khách. Route cũng trả `{ skipped: true }` (không
  phải lỗi) khi thiếu biến môi trường, đúng tinh thần "tính năng tuỳ chọn".
- **3 sự kiện được báo**: đơn hàng mới (kèm danh sách món + tổng tiền), yêu
  cầu hỗ trợ mới (gọi nhân viên/xin đá/yêu cầu thanh toán), đánh giá mới
  (điểm 3 hạng mục + nhận xét nếu có) — đúng 3 sự kiện yêu cầu, không thêm
  sự kiện nào khác để tránh spam group Telegram của quán.
- **Bảo mật đáng chú ý — route KHÔNG yêu cầu đăng nhập**: khác
  `/api/print/lan` (bắt buộc `requireStaffOrAdmin`), route Telegram phải cho
  phép KHÁCH ẨN DANH gọi (vì chính khách là người tạo đơn/gọi nhân viên/gửi
  đánh giá). Để không biến route thành nơi "gửi tin nhắn tuỳ ý qua bot của
  quán", route **luôn tự dựng nội dung tin nhắn ở SERVER** theo 3 mẫu cố
  định (`buildMessageText` trong route.ts) — không có nhánh nào nhận một
  trường "text" tự do từ client. Từng trường đầu vào đều được validate kiểu +
  chặn giá trị vô lý (số bàn phải nguyên dương < 1000, tên món/nhận xét bị
  cắt độ dài) trước khi đưa vào tin nhắn. Đây là mức an toàn tương đương RLS
  đã chấp nhận cho chính các bảng `orders`/`staff_calls`/`feedbacks` (khách
  ẩn danh vốn đã tạo thẳng được các dòng này qua Supabase), không phải một lỗ
  hổng mới.
- **`tableNumber` được CALLER truyền vào, không tự query lại**: khách (anon)
  chỉ có policy RLS **INSERT** trên `staff_calls`/`feedbacks` (không có
  SELECT — xem mục 6.2/9.4), nên `.insert().select()` sẽ luôn trả về 0 dòng
  do RLS lọc mất kết quả RETURNING. Thay vì vướng lỗi đó, `tableNumber` được
  truyền thẳng từ màn hình khách (vốn đã có sẵn qua `useTable()`) xuống
  `createStaffCall(tableId, requestType, tableNumber)` và
  `submitFeedback({ ..., tableNumber })` — vừa tránh lỗi RLS vừa đỡ tốn 1
  round-trip. Riêng `orders` có SELECT công khai (`using (true)`, xem mục
  6.2) nên `order.service.createOrder` lấy `table_number` ngay trong CÙNG
  lệnh insert (`select("*, table:tables(table_number)")`), không cần
  truyền tay.

## 11. Quản lý ca làm việc & Chấm công (Module 8)

### 11.1 Schema

- **`shifts`**: `staff_id`, `start_time`/`end_time`, `initial_cash`,
  `final_cash` (null cho tới khi đóng ca), `total_revenue_cash`,
  `total_revenue_transfer`, `status` (`'active' | 'closed'`).
- **Mỗi nhân viên chỉ có tối đa 1 ca đang mở** — đảm bảo ở TẦNG DATABASE bằng
  partial unique index (`create unique index ... on shifts (staff_id) where
  status = 'active'`), không phải trigger hay khoá ứng dụng — đúng ngay cả
  khi có race condition. `shift.service.startShift()` vẫn pre-check trước để
  trả lỗi thân thiện thay vì để lộ lỗi Postgres khó hiểu ra UI.
- **`orders.shift_id`** (nullable, FK tới `shifts`) — xem mục 11.2 về THỜI
  ĐIỂM gắn cột này.
- **RPC `close_shift(p_shift_id, p_final_cash)`** (`plpgsql`, `security
  invoker`): tính `total_revenue_cash`/`total_revenue_transfer`/số đơn đã thu
  tiền MỘT LẦN DUY NHẤT ngay tại Postgres bằng 1 câu `UPDATE ... RETURNING`
  kèm subquery tương quan trên `orders`, thay vì duy trì bộ đếm cộng dồn ở
  mỗi lượt thanh toán — đơn giản hơn, và luôn đúng dù hệ thống có gặp sự cố
  giữa ca (số liệu được tính lại từ `orders` thật tại thời điểm đóng ca, chứ
  không phụ thuộc bộ đếm có được cập nhật đầy đủ hay không). `security
  invoker` (mặc định) vẫn an toàn vì RLS trên `shifts` (UPDATE) và `orders`
  (SELECT) tiếp tục áp dụng cho người gọi.
- RLS: nhân viên chỉ SELECT/INSERT/UPDATE được ca của CHÍNH MÌNH
  (`staff_id = auth.uid()`); admin có thêm quyền SELECT toàn bộ ca (đọc lịch
  sử ở `/admin/shifts`). **Chưa có** policy cho phép admin sửa/đóng ca thay
  nhân viên khác — nếu cần tính năng "chủ quán tự tay sửa chênh lệch tiền
  mặt", cần bổ sung 1 policy UPDATE riêng cho admin sau này.

### 11.2 Vì sao gắn `shift_id` lúc THANH TOÁN, không phải lúc TẠO ĐƠN

Khách tự đặt món ẩn danh (`order.service.createOrder`), không có nhân viên
nào đứng trực ở bước đó, nên không có ca nào để gắn. `shift_id` chỉ thực sự
có ý nghĩa ở bước NHÂN VIÊN xác nhận đã thu tiền
(`order.service.markOrdersPaid`) — đúng lúc doanh thu "thuộc về" ca của nhân
viên thu ngân đang trực. Hàm này tra ca đang mở của nhân viên hiện đăng nhập
rồi gắn NGAY TRONG CÙNG câu UPDATE đổi `payment_status`/`status` (chính sách
RLS `"Staff confirm payment"` vốn đã cho phép sửa mọi cột trên `orders`, nên
không cần policy mới).

**Không chặn thanh toán nếu quên "Bắt đầu ca"**: nếu nhân viên quên bấm "Bắt
đầu ca", `shift_id` đơn giản là `null` và tiền vẫn được xác nhận đầy đủ —
đúng nguyên tắc xuyên suốt dự án "tiền đã thu là sự thật quan trọng nhất".
`markOrdersPaid` trả về `{ shiftId }` để `PaymentConfirmSheet` hiện toast
nhắc nhở (không chặn) khi `shiftId` là `null`.

### 11.3 Check-in / Check-out cho nhân viên

- Widget `ShiftControl` gắn ở `StaffNav` (hiển thị trên MỌI trang
  `/staff/*`) — nút "Bắt đầu ca" khi chưa có ca mở, hoặc badge giờ bắt đầu +
  nút "Kết thúc ca" khi đang có ca.
- **Bắt đầu ca** (`StartShiftDialog`): nhập tiền mặt đầu ca → `startShift()`.
- **Kết thúc ca** (`EndShiftDialog`, 2 bước): (1) nhập tiền mặt THỰC ĐẾM →
  gọi RPC `close_shift`; (2) hiển thị **Báo cáo chốt ca** (`ShiftSummaryCard`)
  — tổng tiền mặt, tổng chuyển khoản VietQR, số đơn đã phục vụ, tiền đầu ca,
  tiền mặt cần bàn giao (`initial_cash + total_revenue_cash`), và chênh lệch
  so với tiền thực đếm (màu xanh lá nếu khớp, xanh dương nếu dư, đỏ nếu
  thiếu) — bấm "Hoàn tất" mới đóng dialog, tránh đóng nhầm khi chưa kịp đọc
  số liệu bàn giao.
- `lib/shifts.ts` (`calculateExpectedHandover`/`calculateCashDiscrepancy`) là
  NGUỒN DUY NHẤT cho 2 công thức trên — dùng lại y hệt ở
  `ShiftDetailDialog` bên Admin để không lệch số giữa 2 nơi.

### 11.4 Quản trị ca làm ở Admin

`/admin/shifts` (`useShiftHistory`, realtime qua kênh `public:shifts`) — 3
thẻ thống kê (đang mở ca, tổng tiền mặt đã thu, số ca lệch quỹ) + bảng lịch
sử toàn bộ nhân viên (tên, giờ vào/ra, tiền mặt/chuyển khoản, chênh lệch,
trạng thái) — bấm 1 dòng để xem chi tiết đầy đủ qua `ShiftDetailDialog` (tái
sử dụng `ShiftSummaryCard` của màn nhân viên).

## 12. Khuyến mãi, Mã giảm giá & Khung giờ vàng (Module 9)

### 12.1 Schema

- **`promotions`**: `code` (nullable — `null` cho khuyến mãi TỰ ĐỘNG áp dụng),
  `discount_type` (`'percentage' | 'fixed'`), `discount_value`,
  `min_order_value`, `start_time`/`end_time` (khoảng ngày có hiệu lực),
  `daily_start_time`/`daily_end_time` (khung giờ vàng TRONG NGÀY, cả 2 đều
  `null` nghĩa là áp dụng suốt `start_time..end_time` — CHƯA hỗ trợ khung giờ
  qua đêm kiểu 22:00→02:00, cần thì tạo 2 dòng riêng), `requires_code` (ràng
  buộc CHECK: `true` thì `code` bắt buộc có giá trị, `false` thì `code` bắt
  buộc `null`), `usage_limit`/`times_used`, `is_active`.
- **`orders.promotion_id`** (FK `on delete set null` — xoá khuyến mãi không
  làm mất lịch sử đơn đã dùng nó) + **`orders.discount_amount`** (lưu RIÊNG,
  không suy ngược từ khuyến mãi + total_amount, để giữ đúng số tiền đã giảm
  tại THỜI ĐIỂM đặt hàng kể cả nếu khuyến mãi sau đó bị sửa/xoá).
- **RPC `redeem_promotion(p_promotion_id, p_order_subtotal)`** — điểm khác
  biệt lớn nhất so với mọi RPC trước đó: đây là hàm **SECURITY DEFINER** đầu
  tiên trong schema (mọi RPC ở Module 5/6/8 đều `security invoker`). Lý do:
  khách (`anon`) cần gọi được hàm này để tăng `times_used`, nhưng KHÔNG được
  cấp quyền UPDATE trực tiếp lên `promotions` (nếu cấp, khách rành kỹ thuật có
  thể tự ý đổi `is_active`/`discount_value` của bất kỳ mã nào qua Supabase
  API thẳng). Hàm tự kiểm tra lại TOÀN BỘ điều kiện (còn hạn, đúng khung giờ
  vàng, đủ giá trị tối thiểu, còn lượt dùng) — không tin bất kỳ gì client đã
  tự kiểm tra trước — dùng `select ... for update` để khoá đúng 1 dòng, tránh
  2 khách cùng "thắng" lượt cuối cùng của 1 mã; `set search_path = public,
  pg_temp` để chặn rủi ro chiếm quyền qua search_path (khuyến nghị bảo mật
  chuẩn cho MỌI hàm SECURITY DEFINER).
- **RPC `release_promotion_usage(p_promotion_id)`** — hoàn lại 1 lượt dùng
  khi `order.service.createOrder` tạo đơn thất bại SAU KHI đã redeem thành
  công, tránh lãng phí lượt của khách cho 1 đơn không thành.
- **Đánh đổi đã biết**: `p_order_subtotal` do CLIENT tự tính và truyền vào —
  giống hệt cách `total_amount` của đơn hàng vốn đã luôn do client tính từ
  Module 1 tới giờ (server không đối chiếu lại với `order_items`/`menu_items`,
  vì topping/option không lưu giá riêng trên `order_items`). Chấp nhận được vì
  không làm xấu thêm mức tin cậy vốn đã có sẵn của `total_amount`.

### 12.2 Áp dụng mã giảm giá ở giỏ hàng (Module 1)

`CouponSection` (trong `/order/cart`) hỗ trợ 2 luồng, mã thủ công LUÔN ưu
tiên hơn tự động nếu khách chủ động nhập:

- **Mã thủ công**: khách nhập mã → `findPromotionByCode` tra theo RLS (chỉ
  thấy mã đang `is_active` và trong khoảng hiệu lực) → xem trước ngay bằng
  `lib/promotions.ts#previewPromotionDiscount` (thuần client, không round-trip
  server) để hiển thị số tiền giảm/lý do chưa đủ điều kiện (vd chưa đạt đơn
  tối thiểu) NGAY LẬP TỨC mỗi khi giỏ hàng thay đổi.
- **Tự động (Happy Hour)**: khi khách chưa nhập mã nào, hệ thống tự tải các
  khuyến mãi `requires_code = false` và chọn mã giảm NHIỀU NHẤT trong số đang
  đủ điều kiện — không cần thao tác gì từ khách.
- **Xác thực cuối cùng luôn ở server**: bản xem trước ở trên CHỈ phục vụ UI.
  Khi khách bấm gửi đơn, `order.service.createOrder` gọi RPC
  `redeem_promotion` để tính lại và ghi nhận CHÍNH THỨC. Nếu mã vừa hết
  lượt/hết hạn đúng lúc đó, đơn **KHÔNG bị chặn** — chỉ tự động bỏ giảm giá
  và báo khách qua toast, đúng tinh thần "đừng để lỗi phụ làm hỏng luồng
  chính" xuyên suốt dự án.

### 12.3 Quản trị khuyến mãi ở Admin

`/admin/promotions` (`usePromotions`, realtime qua kênh `public:promotions`)
— 3 thẻ thống kê (tổng số, đang bật, tự động/Happy Hour) + bảng danh sách
(mã hoặc nhãn "Tự động", mức giảm, đơn tối thiểu, khoảng hiệu lực, số lượt
đã dùng/giới hạn, công tắc bật-tắt nhanh) + form thêm/sửa
(`PromotionFormDialog`) với ô "Yêu cầu khách nhập mã" (tắt để tạo khuyến mãi
Happy Hour tự động, ẩn luôn ô nhập mã) và ô "Chỉ áp dụng theo khung giờ vàng
trong ngày" (bật thêm 2 input giờ bắt đầu/kết thúc).

## 13. Phân tích dữ liệu nâng cao & Báo cáo kinh doanh thông minh (Module 10)

Không thêm bảng/RPC nào mới — toàn bộ chỉ số đều TÍNH TỪ dữ liệu có sẵn
(`orders`, `order_items`, `customers`), gộp ở tầng client giống hệt cách
Module 3 đã làm với `getRevenueSeries`/`getBestSellers`, chấp nhận được ở quy
mô 1 quán 15 bàn.

### 13.1 Các chỉ số mới trong `analytics.service.ts`

- **AOV (Average Order Value)**: `revenueTotal / paidOrdersCount` — CHỈ chia
  cho số đơn ĐÃ THANH TOÁN, khác với `ordersCount` (đếm toàn bộ đơn phát
  sinh trong khoảng lọc kể cả chưa thanh toán, giữ đúng quy ước
  "ordersToday" đã dùng ở `DashboardSummary` từ Module 3).
- **Heatmap khung giờ vàng**: đếm số LƯỢT ĐẶT MÓN (không lọc theo trạng
  thái thanh toán — đo lưu lượng khách, không phải doanh thu) theo cặp
  (thứ trong tuần, giờ trong ngày), chỉ trong khung giờ hoạt động của quán
  (`SHOP_HOUR_RANGE`, 6h-22h, dùng chung với biểu đồ doanh thu theo giờ đã
  có từ Module 3 — tránh định nghĩa khung giờ trùng 2 nơi).
- **Xu hướng doanh thu theo thứ trong tuần**: gộp `total_amount` của các đơn
  đã thanh toán theo Thứ 2 → Chủ Nhật (quy ước Việt Nam, khác `Date.getDay()`
  gốc của JS vốn để Chủ Nhật đứng đầu — xem `lib/analytics.ts#mondayFirstWeekdayIndex`).
- **Tỷ lệ khách quay lại (Retention Rate)**: với mỗi khách hàng thân thiết
  (định danh bằng SĐT qua `customer_id` — Module 5) từng đặt đơn TRONG
  khoảng đang xem, kiểm tra xem họ đã từng có đơn nào TRƯỚC khoảng đó chưa.
  Cần quét ngày đặt sớm nhất của từng khách trên TOÀN BỘ lịch sử (2 cột
  `customer_id, created_at`, không giới hạn theo khoảng lọc) — nhẹ, chấp
  nhận được ở quy mô hiện tại nhưng sẽ cần tối ưu (view/RPC riêng) nếu số
  lượng đơn tăng lên nhiều lần.

### 13.2 "Nhận định thông minh" trên `/admin/dashboard`

`SmartInsightsCard` (`useSmartInsights`) sinh 3 nhận định bằng LUẬT CỐ ĐỊNH
(rules-based text generation) — **KHÔNG gọi mô hình AI nào**, dù tên gọi
"Smart Insights" theo đúng yêu cầu nghiệp vụ ban đầu:

1. **So sánh doanh thu tuần này với tuần trước** — so sánh kiểu
   APPLES-TO-APPLES: nếu hôm nay là Thứ 4, "tuần này" chỉ tính từ Thứ 2 tới
   hết Thứ 4 hiện tại, và "tuần trước" cũng chỉ lấy đúng Thứ 2 tới Thứ 4 của
   tuần trước (`lib/analytics.ts#getWeekComparisonRanges`) — tránh so sánh 1
   tuần chưa trọn vẹn với 1 tuần đã đầy đủ (nếu không sẽ luôn ra kết quả
   "giảm" giả tạo vào đầu tuần).
2. **Món bán chạy nhất tuần này** — tính theo TỈ TRỌNG SỐ LƯỢT GỌI MÓN,
   KHÔNG phải tỉ trọng doanh thu: `order_items` không lưu đơn giá tại thời
   điểm đặt (giới hạn đã biết từ Module 3), nên 1 con số "% doanh thu" tính
   từ giá HIỆN TẠI của món có thể lệch với doanh thu thực đã chốt ở
   `orders.total_amount`. Dùng tỉ trọng số lượng phản ánh đúng thực tế mà
   không đánh đổi độ chính xác.
3. **Khung giờ cao điểm trong tuần** — tìm cửa sổ 2 giờ liên tiếp có tổng số
   lượt đặt món cao nhất (`lib/analytics.ts#findPeakTwoHourWindow`).

Mỗi nhận định luôn có nhánh dự phòng khi thiếu dữ liệu (vd tuần trước chưa
có doanh thu để so sánh) — không bao giờ hiển thị số `NaN`/`Infinity` hay
crash trang Dashboard, đúng tinh thần "không để tính năng phụ làm hỏng
trải nghiệm chính" xuyên suốt dự án.

### 13.3 Trang báo cáo chi tiết `/admin/analytics`

Khác với `/admin/dashboard` (luôn "hôm nay"/toàn bộ lịch sử, không lọc
được), trang này (`useAnalyticsReport`) cho phép chủ quán chọn khoảng thời
gian: Hôm nay / 7 ngày qua / Tháng này / Tuỳ chỉnh (2 input ngày) — hiển thị
4 thẻ thống kê (doanh thu, số đơn, AOV, tỷ lệ khách quay lại), biểu đồ doanh
thu theo thứ trong tuần, bảng top món bán chạy TRONG khoảng đã lọc
(`TopItemsTable`, tách khỏi `BestSellerTable` của Dashboard vốn luôn
all-time) và heatmap khung giờ vàng (`HourlyHeatmap` — tô đậm theo 1 tông
màu doanh thu duy nhất, sáng → đậm, đúng quy tắc dataviz "sequential = 1
hue", kèm chú giải mức độ và `title`/`aria-label` từng ô để đọc số liệu
chính xác khi rê chuột).

Nút "Xuất CSV" (`lib/csv.ts`) gộp toàn bộ số liệu đang xem (chỉ số tổng hợp
+ doanh thu theo thứ + top món) vào 1 file `.csv` duy nhất, tải thẳng về máy
qua Blob (không cần thư viện ngoài) — có thêm BOM UTF-8 ở đầu file để Excel
trên Windows mở đúng tiếng Việt có dấu.

## 14. Quản lý Combo & Set món ưu đãi (Module 11)

### 14.1 Ý tưởng thiết kế cốt lõi: "nổ" combo thành order_items bình thường

Một combo KHÔNG được lưu thành 1 dòng `order_item` "gộp" duy nhất. Lúc khách
thêm combo vào giỏ (`CartContext.addComboLines`), combo được **NỔ** thành
NHIỀU `CartLine` — mỗi món thành phần 1 dòng, giống hệt khách tự gọi lẻ từng
món — rồi `order.service.createOrder` insert thành các `order_items` bình
thường, mỗi dòng vẫn mang `menu_item_id` THẬT + `station_type` THẬT của món
đó. Nhờ vậy:

- **KDS** (`getStationQueue`) route đúng trạm pha chế/bếp cho TỪNG thành phần
  mà KHÔNG cần sửa route logic — kể cả khi 1 combo có món vừa ở quầy bar vừa
  ở bếp.
- **Trừ kho tự động** (`checkAndDeductInventoryForOrderItem`) chạy ĐÚNG theo
  công thức của TỪNG món thành phần khi món đó chuyển `'preparing'` — không
  cần RPC hay bảng công thức "combo" riêng; tổng trừ kho của cả combo tự
  động bằng đúng tổng công thức các món bên trong, thoả đúng yêu cầu "tự
  động trừ kho nguyên liệu dựa trên tổng hợp công thức của các món trong
  combo" mà **không tốn 1 dòng code nào** ở `updateOrderItemStatus`/
  `checkAndDeductInventoryForOrderItem`.

3 cột thêm vào `order_items` (`combo_id`, `combo_group_id`, `combo_name`) chỉ
để GẮN NHÃN hiển thị — hoàn toàn không ảnh hưởng route KDS hay trừ kho:

- `combo_id` — liên kết tới `combos`, `on delete set null` (giống
  `orders.promotion_id` ở Module 9): xoá combo không xoá lịch sử đơn hàng.
- `combo_group_id` — **KHÔNG phải khoá ngoại**, là 1 `uuid` do CLIENT tự sinh
  (`crypto.randomUUID()`) dùng chung cho TOÀN BỘ dòng nổ ra từ CÙNG 1 lần
  "Thêm combo vào giỏ" — dùng để giỏ hàng/hoá đơn gộp nhóm hiển thị.
- `combo_name` — tên combo TẠI THỜI ĐIỂM đặt (denormalized, giống
  `orders.discount_amount` ở Module 9) để KDS/hoá đơn/lịch sử vẫn hiển thị
  đúng tên dù combo bị đổi tên/xoá sau đó.

### 14.2 Giá combo & bất biến `lineTotal = unitPrice * quantity`

`combos.price` là giá TRỌN GÓI, không bắt buộc bằng tổng giá lẻ các món
thành phần (thường THẤP HƠN — đúng bản chất "combo tiết kiệm"). Khi nổ combo
thành nhiều `CartLine`, CHỈ dòng ĐẦU TIÊN mang `unitPrice = combo.price` và
`lineTotal = combo.price * số gói` — các dòng thành phần còn lại có
`unitPrice = lineTotal = 0`. Nhờ vậy tổng giỏ hàng (`sum(lineTotal)`) luôn
bằng đúng giá combo mà KHÔNG cần sửa `createOrder`'s `subtotal` hay bất kỳ
phép tính tổng nào khác trong hệ thống. Giao diện giỏ hàng (`ComboCartCard`)
gộp các dòng cùng `comboGroupId` thành 1 "thẻ combo" duy nhất (tên + tổng
giá + danh sách thành phần không hiện giá riêng) nên khách không thấy các
dòng 0đ "kỳ lạ" này.

Combo KHÔNG hỗ trợ tuỳ chỉnh từng món bên trong (không chọn topping/đổi món)
— đúng yêu cầu nghiệp vụ "thêm nguyên gói combo vào giỏ hàng"; khách chỉ chọn
số LƯỢNG GÓI ở `ComboDetailSheet` trước khi thêm.

### 14.3 Schema & RLS

```sql
combos (id, name, description, price, image_url, is_active, display_order, created_at)
combo_items (id, combo_id, menu_item_id, quantity)
order_items += combo_id, combo_group_id, combo_name
```

`combo_items.menu_item_id` dùng `on delete restrict` — **CỐ Ý KHÁC** với
`recipe_items.menu_item_id` (`on delete cascade`, Module 6): recipe là dữ
liệu nội bộ, còn combo_items quyết định TRỰC TIẾP những gì quán CAM KẾT bán
cho khách — nếu món bị xoá âm thầm khỏi combo, khách có thể trả tiền cho 1
combo thiếu món. Vì vậy Postgres CHẶN việc xoá 1 món đang thuộc bất kỳ combo
nào; `menu.service.ts#deleteMenuItem` đã có thông báo lỗi thân thiện nhắc
gỡ món khỏi combo (hoặc tắt "còn hàng") trước khi xoá.

RLS theo đúng khuôn mẫu đã dùng cho `promotions`/`menu_items`: khách (anon)
CHỈ đọc combo/combo_items của combo ĐANG hiển thị (`is_active = true`, đúng
yêu cầu "khách xem combo đang hoạt động"); chủ quán đọc/ghi toàn bộ (kể cả
combo đã tắt) để quản lý ở `/admin/combos`.

### 14.4 Trải nghiệm khách hàng (`/order`)

Mục **"Combo Tiết Kiệm"** (`ComboSection`/`ComboCard`, `useCombos` — realtime)
hiển thị phía trên danh mục món theo thứ tự `display_order`. Bấm vào 1 combo
mở `ComboDetailSheet` (cùng khuôn mẫu `ItemOptionsSheet`) liệt kê món thành
phần + chọn số lượng gói, "Thêm vào giỏ" gọi `addComboLines`. Giỏ hàng
(`/order/cart`) tự động gộp nhóm các dòng combo thành `ComboCartCard` — xoá
là xoá NGUYÊN combo, không xoá lẻ từng thành phần; thêm 1 combo nữa tạo
1 nhóm mới độc lập (không cộng dồn vào nhóm cũ).

### 14.5 KDS & In ấn

`KdsItemCard` hiển thị badge "🎁 Combo: <tên>" phía trên tên món khi
`ticket.combo_name` khác null — nhân viên biết ngay món này thuộc combo nào
dù mỗi thành phần vẫn là 1 ticket riêng (đúng kiến trúc "nổ" ở mục 14.1).
`OrderStatusCard` (màn hình khách) cũng ghi chú tên combo tương tự.

`print.service.ts#buildReceiptBytes` gộp các dòng cùng `combo_group_id` dưới
1 dòng `COMBO: <tên>` trên hoá đơn nhiệt 80mm, liệt kê từng thành phần thụt
lề bên dưới — không cần tính lại giá riêng cho từng dòng vì hoá đơn hiện tại
vốn chỉ in `TONG CONG` ở cuối, không in đơn giá theo từng dòng món.

### 14.6 Quản trị `/admin/combos`

`ComboFormDialog` là **MỘT dialog duy nhất** (khác `RecipeEditor` ở Module 6,
vốn ghi trực tiếp từng dòng ngay khi soạn): admin nhập thông tin cơ bản +
soạn danh sách món thành phần CỤC BỘ (chưa lưu DB, kiểu picker Select + số
lượng + nút "Thêm" + danh sách xoá được), rồi bấm "Lưu" mới gọi MỘT hàm
`combo.service.ts#saveCombo` duy nhất — upsert `combos` rồi REPLACE TOÀN BỘ
`combo_items` cũ bằng danh sách mới (xoá hết + insert lại), đơn giản hơn
nhiều so với tự diff từng dòng thêm/sửa/xoá. `CombosTable` cho bật/tắt hiển
thị NGAY LẬP TỨC qua `Switch` (giống `PromotionsTable`) — khách thấy thay
đổi realtime nhờ `subscribeToComboChanges` lắng nghe cả 2 bảng `combos` và
`combo_items`.
