-- ============================================================================
-- Gọi Món — schema PostgreSQL / Supabase
-- Chạy trong Supabase SQL Editor. Bật Realtime cho các bảng cần đẩy sự kiện
-- (menu_items, orders, order_items, staff_calls) sau khi tạo bảng.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null unique,
  qr_code_url text,
  status text not null default 'empty' check (status in ('empty', 'ordering', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  price numeric(12, 0) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  station_type text not null check (station_type in ('bar', 'kitchen')),
  created_at timestamptz not null default now()
);

create table if not exists item_options (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  option_name text not null,
  additional_price numeric(12, 0) not null default 0
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id),
  status text not null default 'pending' check (status in ('pending', 'preparing', 'completed', 'cancelled')),
  total_amount numeric(12, 0) not null default 0,
  payment_method text check (payment_method in ('cash', 'transfer')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid not null references menu_items (id),
  quantity int not null check (quantity > 0),
  notes text,
  item_status text not null default 'pending' check (item_status in ('pending', 'preparing', 'ready', 'served')),
  station_type text not null check (station_type in ('bar', 'kitchen')),
  created_at timestamptz not null default now()
);

create table if not exists vat_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  company_name text not null,
  tax_code text not null,
  address text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists staff_calls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id),
  request_type text not null check (request_type in ('call_staff', 'need_ice', 'checkout')),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Module 4 — Tài khoản nội bộ & phân quyền (Supabase Auth)
--
-- KHÔNG có trang đăng ký công khai: tài khoản nhân viên/chủ quán được tạo thủ
-- công qua Supabase Dashboard (Authentication -> Add user), trigger bên dưới
-- tự tạo 1 dòng `profiles` với role mặc định 'staff'. Để cấp quyền chủ quán
-- cho 1 tài khoản, chạy:
--   update profiles set role = 'admin' where email = 'chuquan@vidu.com';
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER: cho phép các policy RLS ở NHỮNG BẢNG KHÁC gọi hàm này để
-- kiểm tra role mà không bị chính RLS của `profiles` chặn lại (nếu không có
-- security definer sẽ gây đệ quy — hàm đọc profiles trong lúc RLS của
-- profiles cũng đang được áp dụng cho chính câu lệnh đó).
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Tự động tạo hồ sơ khi có tài khoản Supabase Auth mới (qua Dashboard).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index if not exists idx_menu_items_category on menu_items (category_id);
create index if not exists idx_item_options_menu_item on item_options (menu_item_id);
create index if not exists idx_orders_table on orders (table_id);
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_staff_calls_table on staff_calls (table_id);

-- ----------------------------------------------------------------------------
-- Row Level Security (từ Module 4 — có Supabase Auth thật sự)
--
-- Hai "phía" truy cập:
--   (A) Khách quét QR — luôn là Postgres role `anon` (không đăng nhập). Chỉ
--       được: đọc menu, tạo đơn/món, gửi yêu cầu hỗ trợ, và tự chọn phương
--       thức thanh toán CHO ĐƠN CHƯA THANH TOÁN của mình (xem "with check" ở
--       chính sách update của `orders`/`tables` bên dưới — đây là chốt chặn
--       quan trọng nhất: không có "with check" này thì một khách rành kỹ
--       thuật có thể gọi thẳng Supabase API để tự đánh dấu đơn đã trả tiền mà
--       không cần nhân viên xác nhận).
--   (B) Nhân viên/Chủ quán — Postgres role `authenticated` (đã đăng nhập qua
--       Supabase Auth), có `auth.uid()` khớp 1 dòng trong `profiles`.
--       `public.current_user_role()` trả về 'admin' | 'staff' | null (null
--       nếu chưa đăng nhập, tức là khách). Toàn bộ CRUD menu, quản lý
--       KDS/bàn/yêu cầu hỗ trợ, đọc hoá đơn VAT và số liệu dashboard đều yêu
--       cầu role tương ứng — KHÁC với Module 2/3 trước đây (lúc chưa có Auth
--       thì /staff và /admin dùng chung anon key với khách, ai cũng gọi được).
--
-- LƯU Ý: `menu_items` UPDATE cho phép cả 2 role (staff cần bật/tắt "hết món
-- nhanh", admin cần sửa toàn bộ món) vì RLS ở mức DÒNG không phân biệt được
-- CỘT nào đang bị sửa — muốn chặn staff sửa giá cần thêm cơ chế khác (column
-- privileges hoặc trigger kiểm tra cột thay đổi), ngoài phạm vi bản cập nhật
-- này. Admin luôn có mọi quyền của staff (xem middleware.ts).
--
-- Toàn bộ policy dưới đây có `drop policy if exists` đi kèm nên chạy lại
-- FILE NÀY nhiều lần trên cùng 1 database là an toàn (không còn báo lỗi
-- "policy already exists" như các bản trước).
-- ----------------------------------------------------------------------------

alter table tables enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table item_options enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table vat_invoices enable row level security;
alter table staff_calls enable row level security;
alter table profiles enable row level security;

-- ---- profiles: mỗi user chỉ đọc được hồ sơ của chính mình ----
drop policy if exists "Users read own profile" on profiles;
create policy "Users read own profile" on profiles for select using (auth.uid() = id);

-- ---- profiles (mở rộng — UI quản lý tài khoản nhân viên `/admin/staff`):
--      chủ quán đọc TOÀN BỘ hồ sơ (danh sách tài khoản) và SỬA (hiện tại chỉ
--      dùng để đổi `role`, xem services/staff.service.ts#updateStaffRole) —
--      2 policy permissive này CỘNG THÊM vào "Users read own profile" ở
--      trên, không thay thế (nhân viên thường vẫn chỉ đọc được hồ sơ của
--      chính mình). TẠO/XOÁ tài khoản KHÔNG đi qua RLS — `auth.users` chỉ
--      sửa được bằng Supabase Auth Admin API (service role key), xem
--      src/app/api/admin/staff/**/route.ts + lib/supabase/admin.ts.
--      LƯU Ý (giống menu_items — RLS mức DÒNG không phân biệt được CỘT):
--      policy UPDATE dưới đây về lý thuyết cho phép admin sửa MỌI cột của
--      MỌI hồ sơ (kể cả `email`, dù UI hiện tại chỉ gửi `role`) — sửa
--      `email` qua đây sẽ KHÔNG đồng bộ với email đăng nhập thật trong
--      `auth.users`, chỉ nên đổi email qua Supabase Auth Admin API. ----
drop policy if exists "Admin read profiles" on profiles;
create policy "Admin read profiles" on profiles for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin update profiles" on profiles;
create policy "Admin update profiles" on profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---- Đọc menu: công khai cho mọi người (khách + nhân viên + chủ quán) ----
drop policy if exists "Public read tables" on tables;
create policy "Public read tables" on tables for select using (true);

drop policy if exists "Public read categories" on categories;
create policy "Public read categories" on categories for select using (true);

drop policy if exists "Public read menu_items" on menu_items;
create policy "Public read menu_items" on menu_items for select using (true);

drop policy if exists "Public read item_options" on item_options;
create policy "Public read item_options" on item_options for select using (true);

-- ---- tables: khách được set 'ordering' khi gửi đơn; MỌI trạng thái khác
--      (đặc biệt là trả bàn về 'empty' sau khi thu tiền) chỉ nhân viên/chủ
--      quán mới được phép. ----
drop policy if exists "Public update tables status" on tables;
drop policy if exists "Anon set table ordering" on tables;
create policy "Anon set table ordering" on tables for update
  using (true)
  with check (status = 'ordering');

drop policy if exists "Staff update tables" on tables;
create policy "Staff update tables" on tables for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (true);

-- ---- menu_items: staff bật/tắt hết món, admin sửa toàn bộ; thêm/xoá món
--      (thay đổi cấu trúc menu) chỉ admin. ----
drop policy if exists "Public update menu_items" on menu_items;
drop policy if exists "Staff update menu_items" on menu_items;
create policy "Staff update menu_items" on menu_items for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Public insert menu_items" on menu_items;
drop policy if exists "Admin insert menu_items" on menu_items;
create policy "Admin insert menu_items" on menu_items for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public delete menu_items" on menu_items;
drop policy if exists "Admin delete menu_items" on menu_items;
create policy "Admin delete menu_items" on menu_items for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- categories: chỉ chủ quán CRUD (quản lý menu) ----
drop policy if exists "Public insert categories" on categories;
drop policy if exists "Admin insert categories" on categories;
create policy "Admin insert categories" on categories for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public update categories" on categories;
drop policy if exists "Admin update categories" on categories;
create policy "Admin update categories" on categories for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public delete categories" on categories;
drop policy if exists "Admin delete categories" on categories;
create policy "Admin delete categories" on categories for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- item_options: chỉ chủ quán CRUD ----
drop policy if exists "Public insert item_options" on item_options;
drop policy if exists "Admin insert item_options" on item_options;
create policy "Admin insert item_options" on item_options for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public update item_options" on item_options;
drop policy if exists "Admin update item_options" on item_options;
create policy "Admin update item_options" on item_options for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public delete item_options" on item_options;
drop policy if exists "Admin delete item_options" on item_options;
create policy "Admin delete item_options" on item_options for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- orders: khách tạo đơn + tự chọn phương thức thanh toán khi CHƯA trả
--      tiền; chốt thanh toán (payment_status/status) CHỈ nhân viên/chủ quán. ----
drop policy if exists "Public insert orders" on orders;
create policy "Public insert orders" on orders for insert with check (true);

drop policy if exists "Public read orders" on orders;
create policy "Public read orders" on orders for select using (true);

drop policy if exists "Public update orders payment" on orders;
drop policy if exists "Anon set payment method" on orders;
create policy "Anon set payment method" on orders for update
  using (true)
  with check (payment_status = 'unpaid' and status in ('pending', 'preparing'));

drop policy if exists "Staff confirm payment" on orders;
create policy "Staff confirm payment" on orders for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- ---- order_items: khách tạo món kèm đơn + đọc trạng thái; đổi item_status
--      (KDS: pending -> preparing -> ready -> served) CHỈ nhân viên/chủ quán. ----
drop policy if exists "Public insert order_items" on order_items;
create policy "Public insert order_items" on order_items for insert with check (true);

drop policy if exists "Public read order_items" on order_items;
create policy "Public read order_items" on order_items for select using (true);

drop policy if exists "Public update order_items" on order_items;
drop policy if exists "Staff update order_items" on order_items;
create policy "Staff update order_items" on order_items for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- ---- vat_invoices: khách gửi yêu cầu xuất hoá đơn lúc thanh toán; CHỈ chủ
--      quán mới xem được danh sách/số liệu (trang /admin/vat-invoices). ----
drop policy if exists "Public insert vat_invoices" on vat_invoices;
create policy "Public insert vat_invoices" on vat_invoices for insert with check (true);

drop policy if exists "Public read vat_invoices" on vat_invoices;
drop policy if exists "Admin read vat_invoices" on vat_invoices;
create policy "Admin read vat_invoices" on vat_invoices for select
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- staff_calls: khách gửi yêu cầu; CHỈ nhân viên/chủ quán đọc danh sách
--      và đánh dấu đã xử lý (khách không cần đọc lại staff_calls). ----
drop policy if exists "Public insert staff_calls" on staff_calls;
create policy "Public insert staff_calls" on staff_calls for insert with check (true);

drop policy if exists "Public read staff_calls" on staff_calls;
drop policy if exists "Staff read staff_calls" on staff_calls;
create policy "Staff read staff_calls" on staff_calls for select
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Public update staff_calls" on staff_calls;
drop policy if exists "Staff update staff_calls" on staff_calls;
create policy "Staff update staff_calls" on staff_calls for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- ============================================================================
-- Module 5 — Vận hành nâng cao: In nhiệt trực tiếp, Khách hàng thân thiết,
-- Đánh giá sau thanh toán.
-- ============================================================================

-- ---- Khách hàng thân thiết: định danh bằng SỐ ĐIỆN THOẠI, KHÔNG xác thực
--      OTP (ngoài phạm vi bản cập nhật này — không tích hợp SMS). Vì vậy đây
--      là mức bảo mật "biết SĐT là tra được điểm", tương tự việc "biết
--      table_id là xem được đơn" đã chấp nhận từ Module 1. ----
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  points int not null default 0 check (points >= 0),
  total_spent numeric(12, 0) not null default 0 check (total_spent >= 0),
  created_at timestamptz not null default now()
);

-- Liên kết đơn hàng với khách hàng thân thiết (nullable — khách không nhập SĐT vẫn đặt món bình thường).
alter table orders add column if not exists customer_id uuid references customers (id);

-- Lịch sử tích điểm (sổ cái) — cho phép hiển thị "lịch sử tích điểm" ở màn
-- hình khách và về sau có thể mở rộng thêm điều chỉnh thủ công/đổi điểm mà
-- không cần đổi cấu trúc bảng customers.
create table if not exists loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  points_change int not null,
  reason text not null default 'earn_order' check (reason in ('earn_order', 'manual_adjust')),
  created_at timestamptz not null default now()
);

-- Cộng điểm nguyên tử (tránh race-condition đọc-sửa-ghi khi 2 lượt thanh toán
-- cùng lúc): gộp UPDATE customers + INSERT loyalty_transactions vào 1 lệnh gọi
-- SQL duy nhất. security invoker (mặc định) — RLS của customers/loyalty_transactions
-- vẫn áp dụng theo đúng quyền của người gọi (nhân viên/chủ quán), KHÔNG bypass RLS.
create or replace function public.award_loyalty_points(
  p_customer_id uuid,
  p_order_id uuid,
  p_points int,
  p_amount numeric
) returns void
language plpgsql
as $$
begin
  update public.customers
  set points = points + p_points,
      total_spent = total_spent + p_amount
  where id = p_customer_id;

  insert into public.loyalty_transactions (customer_id, order_id, points_change, reason)
  values (p_customer_id, p_order_id, p_points, 'earn_order');
end;
$$;

-- ---- Đánh giá sau thanh toán: mỗi đơn hàng chỉ được đánh giá 1 lần
--      (unique order_id) để tránh spam từ màn hình khách. ----
create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id) on delete cascade,
  rating_beverage int not null check (rating_beverage between 1 and 5),
  rating_service int not null check (rating_service between 1 and 5),
  rating_space int not null check (rating_space between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_customer on orders (customer_id);
create index if not exists idx_loyalty_transactions_customer on loyalty_transactions (customer_id);

alter table customers enable row level security;
alter table loyalty_transactions enable row level security;
alter table feedbacks enable row level security;

-- ---- customers: tra cứu/tự đăng ký công khai (không đăng nhập) theo đúng
--      luồng "nhập SĐT lúc gửi đơn"; CHỈ nhân viên/chủ quán mới được sửa
--      (cộng điểm qua award_loyalty_points ở trên, hoặc điều chỉnh thủ công
--      sau này). LƯU Ý bảo mật: select using(true) nghĩa là bất kỳ ai gọi
--      thẳng Supabase API cũng liệt kê được toàn bộ khách hàng — đánh đổi đã
--      chấp nhận vì không có xác thực OTP; nếu cần chặt hơn, bổ sung OTP rồi
--      thu hẹp policy này theo auth.uid() của khách. ----
drop policy if exists "Public read customers" on customers;
create policy "Public read customers" on customers for select using (true);

drop policy if exists "Public insert customers" on customers;
create policy "Public insert customers" on customers for insert with check (true);

drop policy if exists "Staff update customers" on customers;
create policy "Staff update customers" on customers for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- ---- loyalty_transactions: khách xem lịch sử của chính khách (cùng đánh đổi
--      "biết SĐT" như customers ở trên); CHỈ nhân viên/chủ quán được ghi (qua
--      award_loyalty_points lúc xác nhận thanh toán). ----
drop policy if exists "Public read loyalty_transactions" on loyalty_transactions;
create policy "Public read loyalty_transactions" on loyalty_transactions for select using (true);

drop policy if exists "Staff insert loyalty_transactions" on loyalty_transactions;
create policy "Staff insert loyalty_transactions" on loyalty_transactions for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'staff'));

-- ---- feedbacks: khách gửi đánh giá (không cần đăng nhập); CHỈ chủ quán xem
--      được danh sách (giống vat_invoices) — nhân viên không cần xem đánh giá. ----
drop policy if exists "Public insert feedbacks" on feedbacks;
create policy "Public insert feedbacks" on feedbacks for insert with check (true);

drop policy if exists "Admin read feedbacks" on feedbacks;
create policy "Admin read feedbacks" on feedbacks for select
  to authenticated
  using (public.current_user_role() = 'admin');

-- ============================================================================
-- Module 6 — Quản lý kho theo công thức (Recipe-based Inventory)
-- ============================================================================

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  stock_quantity numeric(12, 2) not null default 0,
  min_threshold numeric(12, 2) not null default 0 check (min_threshold >= 0),
  created_at timestamptz not null default now()
);
-- CỐ Ý không có check (stock_quantity >= 0): khi trừ kho tự động mà nguyên
-- liệu không đủ, quán vẫn muốn cho bếp/bar TIẾP TỤC làm món (xem
-- deduct_inventory_for_order_item bên dưới) và chỉ cảnh báo — nếu chặn bằng
-- CHECK constraint ở đây, câu UPDATE trừ kho sẽ LỖI và làm hỏng luôn thao tác
-- chuyển trạng thái món trên KDS.

-- Công thức: 1 món trong menu tiêu hao bao nhiêu đơn vị của mỗi nguyên liệu.
create table if not exists recipe_items (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  quantity_required numeric(12, 3) not null check (quantity_required > 0),
  unique (menu_item_id, ingredient_id)
);

create index if not exists idx_recipe_items_menu_item on recipe_items (menu_item_id);
create index if not exists idx_recipe_items_ingredient on recipe_items (ingredient_id);

-- Cấu hình toàn quán, dùng kiểu "singleton table" của Postgres: `id` là
-- boolean với check(id) nên CHỈ CÓ THỂ có đúng 1 dòng (id luôn = true) —
-- tránh phải tạo cả 1 hệ thống multi-row settings chỉ để lưu 1 cờ bật/tắt.
create table if not exists shop_settings (
  id boolean primary key default true check (id),
  block_order_when_insufficient_stock boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into shop_settings (id) values (true) on conflict (id) do nothing;

-- Trừ kho NGUYÊN TỬ cho TOÀN BỘ nguyên liệu của 1 món trong 1 câu UPDATE duy
-- nhất (không phải gọi nhiều lần từ client, tránh trừ dở dang nếu lỗi giữa
-- chừng). Gọi từ order.service.updateOrderItemStatus() khi món chuyển sang
-- 'preparing'. security invoker (mặc định) — RLS của `ingredients` vẫn áp
-- dụng theo đúng quyền người gọi (chỉ staff/admin gọi được, xem RLS bên dưới).
create or replace function public.deduct_inventory_for_order_item(
  p_menu_item_id uuid,
  p_quantity_ordered int
) returns void
language sql
as $$
  update public.ingredients i
  set stock_quantity = i.stock_quantity - (ri.quantity_required * p_quantity_ordered)
  from public.recipe_items ri
  where ri.menu_item_id = p_menu_item_id
    and ri.ingredient_id = i.id;
$$;

-- Cộng kho NGUYÊN TỬ khi nhập hàng (tránh đọc-sửa-ghi từ client nếu 2 nhân
-- viên cùng nhập kho 1 nguyên liệu gần như đồng thời).
create or replace function public.adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_delta numeric
) returns void
language sql
as $$
  update public.ingredients set stock_quantity = stock_quantity + p_delta where id = p_ingredient_id;
$$;

alter table ingredients enable row level security;
alter table recipe_items enable row level security;
alter table shop_settings enable row level security;

-- ---- ingredients: đọc (để tính trừ kho lúc KDS đổi trạng thái + xem tồn
--      kho) cho cả staff/admin; nhập hàng/sửa ngưỡng cũng cho cả 2 role
--      (giống menu_items — RLS mức DÒNG không tách được ai chỉ được nhập
--      hàng, ai được sửa tên/đơn vị); tạo mới/xoá nguyên liệu CHỈ admin. ----
drop policy if exists "Staff read ingredients" on ingredients;
create policy "Staff read ingredients" on ingredients for select
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Staff update ingredients" on ingredients;
create policy "Staff update ingredients" on ingredients for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Admin insert ingredients" on ingredients;
create policy "Admin insert ingredients" on ingredients for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete ingredients" on ingredients;
create policy "Admin delete ingredients" on ingredients for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- recipe_items: đọc cho cả staff/admin (cần để tính trừ kho lúc KDS đổi
--      trạng thái món); CHỈ admin được sửa công thức (trang /admin/inventory). ----
drop policy if exists "Staff read recipe_items" on recipe_items;
create policy "Staff read recipe_items" on recipe_items for select
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Admin insert recipe_items" on recipe_items;
create policy "Admin insert recipe_items" on recipe_items for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update recipe_items" on recipe_items;
create policy "Admin update recipe_items" on recipe_items for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete recipe_items" on recipe_items;
create policy "Admin delete recipe_items" on recipe_items for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- shop_settings: đọc cho cả staff/admin (KDS cần biết có đang bật chặn
--      khi thiếu kho không); CHỈ admin đổi cấu hình. Không cho insert/delete
--      qua ứng dụng — dòng duy nhất đã được seed sẵn ở trên. ----
drop policy if exists "Staff read shop_settings" on shop_settings;
create policy "Staff read shop_settings" on shop_settings for select
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Admin update shop_settings" on shop_settings;
create policy "Admin update shop_settings" on shop_settings for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ============================================================================
-- Module 8 — Quản lý ca làm việc & Chấm công nhân viên (Staff Shifts & Attendance)
-- ============================================================================

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  -- Tiền lẻ đầu ca (thối tiền) — nhân viên tự nhập lúc "Bắt đầu ca".
  initial_cash numeric(12, 2) not null default 0 check (initial_cash >= 0),
  -- Tiền mặt THỰC TẾ nhân viên đếm được lúc "Kết thúc ca" (null khi ca còn
  -- đang mở) — so với số tiền HỆ THỐNG TÍNH RA (initial_cash +
  -- total_revenue_cash, xem lib/shifts.ts) để phát hiện chênh lệch quỹ.
  final_cash numeric(12, 2) check (final_cash >= 0),
  -- 2 cột dưới đây là SỐ CHỐT — chỉ được tính và ghi MỘT LẦN bởi hàm
  -- close_shift() khi kết thúc ca (xem bên dưới), không cập nhật realtime
  -- trong lúc ca đang mở: báo cáo chốt ca chỉ cần hiển thị lúc đóng ca, tính
  -- trực tiếp từ `orders` lúc đó là đủ — tránh phải bảo trì bộ đếm cộng dồn
  -- (increment) trên từng giao dịch thanh toán, giữ logic đơn giản và luôn
  -- đúng vì được suy ra thẳng từ dữ liệu `orders` gốc.
  total_revenue_cash numeric(12, 2) not null default 0,
  total_revenue_transfer numeric(12, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

-- Mỗi nhân viên CHỈ được có 1 ca 'active' tại một thời điểm — partial unique
-- index (chỉ áp dụng cho dòng status = 'active') là cách gọn nhất để Postgres
-- tự chặn việc bắt đầu ca thứ 2 khi ca trước chưa đóng, không cần thêm bảng
-- hay trigger riêng.
create unique index if not exists idx_shifts_one_active_per_staff
  on shifts (staff_id)
  where status = 'active';

create index if not exists idx_shifts_staff on shifts (staff_id);

-- Liên kết GIAO DỊCH THANH TOÁN với ca làm việc của nhân viên thu ngân đang
-- trực lúc xác nhận thu tiền (order.service.markOrdersPaid) — KHÔNG gắn lúc
-- tạo đơn vì đơn do chính khách tự đặt qua QR (không có nhân viên nào thao
-- tác lúc đó), nullable vì thanh toán vẫn phải được xác nhận bình thường kể
-- cả khi nhân viên quên "Bắt đầu ca" (không chặn nghiệp vụ chính).
alter table orders add column if not exists shift_id uuid references shifts (id);
create index if not exists idx_orders_shift on orders (shift_id);

-- Đóng ca NGUYÊN TỬ: tính tổng doanh thu tiền mặt/chuyển khoản + số đơn đã
-- thu tiền trong ca TRỰC TIẾP từ `orders` (không dựa vào bộ đếm cộng dồn nào
-- khác) rồi ghi vào đúng 1 câu UPDATE, trả thẳng dòng shift đã đóng kèm
-- order_count để client hiển thị Báo cáo chốt ca ngay, không cần round-trip
-- thứ 2. `security invoker` (mặc định) — vẫn bị RLS của người gọi (chính
-- nhân viên sở hữu ca, xem policy "Staff update own shift" bên dưới) chi
-- phối trên UPDATE shifts; SELECT trên `orders` vốn công khai nên không vướng RLS.
create or replace function public.close_shift(
  p_shift_id uuid,
  p_final_cash numeric
)
returns table (
  id uuid,
  staff_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  initial_cash numeric,
  final_cash numeric,
  total_revenue_cash numeric,
  total_revenue_transfer numeric,
  status text,
  created_at timestamptz,
  order_count bigint
)
language plpgsql
as $$
begin
  return query
  update public.shifts s
  set
    end_time = now(),
    final_cash = p_final_cash,
    total_revenue_cash = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'cash'
    ), 0),
    total_revenue_transfer = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'transfer'
    ), 0),
    status = 'closed'
  where s.id = p_shift_id
    and s.status = 'active'
  returning
    s.id, s.staff_id, s.start_time, s.end_time, s.initial_cash, s.final_cash,
    s.total_revenue_cash, s.total_revenue_transfer, s.status, s.created_at,
    (select count(*) from public.orders o2 where o2.shift_id = s.id and o2.payment_status = 'paid');
end;
$$;

alter table shifts enable row level security;

-- ---- shifts: nhân viên tự quản lý ca CỦA CHÍNH MÌNH (bắt đầu/kết thúc);
--      chủ quán xem được TOÀN BỘ lịch sử ca của mọi nhân viên (trang
--      /admin/shifts) nhưng không sửa/xoá qua ứng dụng (chỉ đọc để theo dõi
--      + đối chiếu chênh lệch quỹ). ----
drop policy if exists "Staff select own shifts" on shifts;
create policy "Staff select own shifts" on shifts for select
  to authenticated
  using (staff_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Staff insert own shift" on shifts;
create policy "Staff insert own shift" on shifts for insert
  to authenticated
  with check (staff_id = auth.uid());

drop policy if exists "Staff update own shift" on shifts;
create policy "Staff update own shift" on shifts for update
  to authenticated
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());

-- ============================================================================
-- Module 9 — Khuyến mãi, Mã giảm giá & Khung giờ vàng (Promotions, Coupons &
-- Happy Hour)
-- ============================================================================

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  -- Mã khách tự nhập ở giỏ hàng — NULL cho khuyến mãi TỰ ĐỘNG áp dụng (Happy
  -- Hour, xem `requires_code` bên dưới). `unique` vẫn đúng với nhiều dòng NULL
  -- (Postgres coi mỗi NULL là khác biệt, không đụng ràng buộc unique).
  code text unique,
  description text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  -- percentage: 0-100 (%, ví dụ 10 = giảm 10%). fixed: số tiền VND cố định.
  discount_value numeric(12, 2) not null
    check (discount_value > 0 and (discount_type = 'fixed' or discount_value <= 100)),
  min_order_value numeric(12, 0) not null default 0 check (min_order_value >= 0),
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time > start_time),
  -- Khung giờ vàng (Happy Hour) TRONG NGÀY, theo giờ địa phương quán
  -- (Asia/Ho_Chi_Minh) — 2 cột đều NULL nghĩa là áp dụng SUỐT khoảng
  -- start_time..end_time, không giới hạn theo giờ trong ngày. Khi đặt cả 2,
  -- khuyến mãi CHỈ có hiệu lực trong khung giờ đó MỖI NGÀY trong khoảng
  -- start_time..end_time (vd: 14:00-16:00 mỗi ngày, từ 1/10 đến 31/10). CHƯA
  -- hỗ trợ khung giờ qua đêm (vd 22:00 -> 02:00) — cần thì tạo 2 dòng riêng.
  daily_start_time time,
  daily_end_time time,
  check ((daily_start_time is null) = (daily_end_time is null)),
  -- true: khách phải tự nhập `code` ở giỏ hàng. false: hệ thống TỰ ÁP DỤNG khi
  -- đủ điều kiện, không cần nhập mã (dùng cho Happy Hour) — khi đó `code`
  -- BẮT BUỘC phải NULL (ràng buộc ngay dưới).
  requires_code boolean not null default true,
  check (requires_code = (code is not null)),
  usage_limit int check (usage_limit > 0),
  times_used int not null default 0 check (times_used >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Liên kết khuyến mãi đã dùng với đơn hàng — gắn ngay lúc TẠO ĐƠN (khác Module
-- 8/shift, vốn gắn lúc THANH TOÁN) vì khuyến mãi ảnh hưởng trực tiếp tới
-- total_amount phải hiển thị cho khách NGAY từ màn hình giỏ hàng, không thể
-- chờ tới lúc nhân viên xác nhận thu tiền. `discount_amount` lưu riêng (không
-- suy ra ngược từ promotion + total_amount) để giữ đúng số tiền đã giảm tại
-- THỜI ĐIỂM đặt hàng, kể cả nếu sau đó khuyến mãi bị chủ quán sửa/xoá.
alter table orders add column if not exists promotion_id uuid references promotions (id) on delete set null;
alter table orders add column if not exists discount_amount numeric(12, 0) not null default 0;
create index if not exists idx_orders_promotion on orders (promotion_id);

-- Áp dụng + ghi nhận lượt dùng khuyến mãi NGUYÊN TỬ — gọi từ
-- order.service.createOrder TRƯỚC khi insert đơn (để biết total_amount đã
-- giảm giá ngay từ đầu, không cần sửa lại đơn sau khi tạo).
--
-- SECURITY DEFINER — KHÁC với mọi hàm RPC trước đó trong file này (vốn đều
-- `security invoker`, xem ghi chú award_loyalty_points/close_shift): khách
-- (anon) cần gọi được hàm này để tăng `times_used`, nhưng KHÔNG được cấp
-- quyền UPDATE trực tiếp lên bảng `promotions` (nếu cấp, khách rành kỹ thuật
-- có thể tự ý đổi is_active/discount_value/usage_limit của bất kỳ mã nào qua
-- Supabase API). `set search_path = public, pg_temp` để chặn rủi ro chiếm
-- quyền qua search_path — khuyến nghị bảo mật chuẩn cho MỌI hàm SECURITY
-- DEFINER. Toàn bộ điều kiện hợp lệ (còn hạn, đúng khung giờ vàng, đạt giá
-- trị tối thiểu, còn lượt dùng) được kiểm tra LẠI ngay trong hàm — KHÔNG tin
-- tưởng bất kỳ điều gì client đã tự kiểm tra trước đó (xem
-- lib/promotions.ts#previewPromotionDiscount, chỉ là bản xem trước cho UI).
-- `select ... for update` khoá đúng 1 dòng promotion để 2 khách cùng dùng nốt
-- lượt cuối cùng của 1 mã không thể cùng "thắng" race điều kiện usage_limit.
--
-- LƯU Ý (đánh đổi đã biết): `p_order_subtotal` do CLIENT tự tính và truyền
-- vào — giống hệt cách `total_amount` của đơn hàng vốn đã luôn do client tính
-- từ Module 1 tới giờ, server KHÔNG đối chiếu lại với order_items/menu_items
-- (topping/option không lưu giá riêng trên order_items, chỉ gộp vào notes —
-- xem README mục "Doanh thu ước tính"). Một khách rành kỹ thuật gọi thẳng API
-- vẫn có thể truyền sai subtotal để dễ đạt min_order_value hơn hoặc giảm
-- nhiều hơn giá trị thật của đơn — chấp nhận được vì KHÔNG làm xấu thêm mức
-- độ tin cậy vốn đã có sẵn của total_amount trong toàn hệ thống.
create or replace function public.redeem_promotion(
  p_promotion_id uuid,
  p_order_subtotal numeric
) returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_promo public.promotions%rowtype;
  v_now timestamptz := now();
  v_local_time time := (v_now at time zone 'Asia/Ho_Chi_Minh')::time;
  v_discount numeric;
begin
  select * into v_promo from public.promotions where id = p_promotion_id for update;

  if not found then
    raise exception 'Mã giảm giá không tồn tại.';
  end if;

  if not v_promo.is_active then
    raise exception 'Mã giảm giá này đã ngừng áp dụng.';
  end if;

  if v_now < v_promo.start_time or v_now > v_promo.end_time then
    raise exception 'Mã giảm giá đã hết hạn hoặc chưa tới thời gian áp dụng.';
  end if;

  if v_promo.daily_start_time is not null
     and not (v_local_time between v_promo.daily_start_time and v_promo.daily_end_time) then
    raise exception 'Mã giảm giá chỉ áp dụng trong khung giờ vàng.';
  end if;

  if p_order_subtotal < v_promo.min_order_value then
    raise exception 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã giảm giá.';
  end if;

  if v_promo.usage_limit is not null and v_promo.times_used >= v_promo.usage_limit then
    raise exception 'Mã giảm giá đã hết lượt sử dụng.';
  end if;

  v_discount := case
    when v_promo.discount_type = 'percentage' then round(p_order_subtotal * v_promo.discount_value / 100)
    else v_promo.discount_value
  end;
  if v_discount > p_order_subtotal then
    v_discount := p_order_subtotal;
  end if;

  update public.promotions set times_used = times_used + 1 where id = p_promotion_id;

  return v_discount;
end;
$$;

-- Hoàn lại 1 lượt dùng khuyến mãi khi tạo đơn thất bại SAU KHI đã redeem (xem
-- order.service.createOrder — chèn order_items lỗi thì phải rollback cả đơn
-- lẫn lượt khuyến mãi vừa dùng) — tránh lãng phí 1 lượt của khách cho 1 đơn
-- không thành công. security definer vì cùng lý do với redeem_promotion ở trên.
create or replace function public.release_promotion_usage(
  p_promotion_id uuid
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.promotions set times_used = greatest(times_used - 1, 0) where id = p_promotion_id;
$$;

alter table promotions enable row level security;

-- ---- promotions: khách (anon) CHỈ đọc được các mã ĐANG hiệu lực (is_active
--      = true và trong khoảng start_time..end_time) — không liệt kê được mã
--      đã tắt/hết hạn/chưa tới ngày áp dụng, giảm bớt khả năng dò mã qua gọi
--      thẳng API. Chủ quán đọc TOÀN BỘ (kể cả đã tắt/hết hạn) để quản lý ở
--      /admin/promotions. Ghi (tạo/sửa/xoá/đổi is_active) CHỈ chủ quán qua
--      ứng dụng; `times_used` CHỈ đổi qua RPC
--      redeem_promotion/release_promotion_usage (security definer, xem
--      trên) — KHÔNG có policy UPDATE nào cấp cho anon. ----
drop policy if exists "Public read active promotions" on promotions;
create policy "Public read active promotions" on promotions for select
  using (is_active = true and now() >= start_time and now() <= end_time);

drop policy if exists "Admin read promotions" on promotions;
create policy "Admin read promotions" on promotions for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin insert promotions" on promotions;
create policy "Admin insert promotions" on promotions for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update promotions" on promotions;
create policy "Admin update promotions" on promotions for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete promotions" on promotions;
create policy "Admin delete promotions" on promotions for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ============================================================================
-- Module 11 — Quản lý Combo & Set món ưu đãi (Combo & Set Menu Management)
--
-- Ý TƯỞNG THIẾT KẾ CỐT LÕI: một combo KHÔNG được lưu thành 1 dòng order_item
-- "gộp" duy nhất — thay vào đó, lúc khách thêm combo vào giỏ, combo được "NỔ"
-- (explode) thành NHIỀU order_items bình thường, MỖI món thành phần 1 dòng,
-- giống hệt như khách tự gọi lẻ từng món (xem CartContext.addComboLines +
-- order.service.createOrder). Mỗi dòng vẫn mang menu_item_id THẬT (từ
-- menu_items) + station_type THẬT của món đó. Nhờ vậy:
--   - KDS (getStationQueue) route đúng trạm pha chế/bếp cho TỪNG thành phần
--     mà KHÔNG cần sửa bất kỳ logic route nào — kể cả khi 1 combo có món vừa
--     ở quầy bar vừa ở bếp.
--   - Trừ kho tự động (deduct_inventory_for_order_item) chạy ĐÚNG theo công
--     thức của TỪNG món thành phần khi món đó chuyển 'preparing' — không cần
--     RPC hay bảng công thức "combo" riêng; tổng trừ kho của cả combo tự động
--     bằng đúng tổng công thức các món bên trong, không tốn thêm 1 dòng code
--     nào ở updateOrderItemStatus/checkAndDeductInventoryForOrderItem.
-- 3 cột thêm vào order_items bên dưới CHỈ để GẮN NHÃN hiển thị (thuộc combo
-- nào, có cùng 1 lần thêm vào giỏ hay không) — KHÔNG ảnh hưởng route
-- KDS/trừ kho, và KHÔNG cần policy RLS mới trên order_items (policy hiện có
-- đã áp dụng ở mức DÒNG, không phân biệt cột).
-- ============================================================================

create table if not exists combos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Giá TRỌN GÓI của combo — KHÔNG bắt buộc bằng tổng giá lẻ các món thành
  -- phần (thường THẤP HƠN, đúng bản chất "combo tiết kiệm"). Giá này được
  -- "chốt" (snapshot) vào dòng order_item đầu tiên nổ ra từ combo lúc khách
  -- thêm vào giỏ — xem CartContext.addComboLines, các dòng thành phần còn lại
  -- có đơn giá 0 để tổng giỏ hàng luôn bằng đúng giá combo, không cộng dồn
  -- nhầm theo giá lẻ từng món.
  price numeric(12, 0) not null check (price >= 0),
  image_url text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos (id) on delete cascade,
  -- CỐ Ý `on delete restrict` — KHÁC với recipe_items.menu_item_id (on delete
  -- cascade, xem Module 6): recipe là dữ liệu nội bộ (mất 1 dòng công thức
  -- không ai nhìn thấy ngay), còn combo_items quyết định TRỰC TIẾP những gì
  -- quán CAM KẾT bán cho khách trong 1 combo — nếu món bị xoá âm thầm khỏi
  -- combo, khách có thể trả tiền cho 1 combo mà không còn đủ món như quảng
  -- cáo. Vì vậy chặn hẳn việc xoá 1 món đang thuộc bất kỳ combo nào — chủ
  -- quán phải chủ động gỡ món khỏi combo (hoặc xoá cả combo) trước, xem
  -- thông báo lỗi thân thiện ở menu.service.ts#deleteMenuItem.
  menu_item_id uuid not null references menu_items (id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  unique (combo_id, menu_item_id)
);

create index if not exists idx_combo_items_combo on combo_items (combo_id);
create index if not exists idx_combo_items_menu_item on combo_items (menu_item_id);

-- 3 cột GẮN NHÃN combo trên order_items — xem giải thích kiến trúc ở đầu mục
-- Module 11. `combo_id` nullable + on delete set null (giống orders.promotion_id
-- ở Module 9): xoá combo không được phép xoá luôn lịch sử đơn hàng đã bán.
-- `combo_group_id` KHÔNG phải khoá ngoại — là 1 uuid do CLIENT tự sinh
-- (crypto.randomUUID()) dùng chung cho TOÀN BỘ các dòng nổ ra từ CÙNG 1 lần
-- "Thêm combo vào giỏ", để giỏ hàng/KDS/hoá đơn gộp nhóm hiển thị; 2 lần thêm
-- cùng 1 combo (khách bấm "thêm 1 combo nữa") sẽ có 2 group id khác nhau.
-- `combo_name` lưu TÊN combo TẠI THỜI ĐIỂM đặt (denormalized, giống
-- orders.discount_amount ở Module 9) để KDS/hoá đơn/lịch sử vẫn hiển thị đúng
-- tên dù sau đó combo bị đổi tên hoặc xoá.
alter table order_items add column if not exists combo_id uuid references combos (id) on delete set null;
alter table order_items add column if not exists combo_group_id uuid;
alter table order_items add column if not exists combo_name text;
create index if not exists idx_order_items_combo_group on order_items (combo_group_id);

alter table combos enable row level security;
alter table combo_items enable row level security;

-- ---- combos: khách (anon) CHỈ đọc combo ĐANG hiển thị (is_active = true) —
--      đúng yêu cầu "khách xem combo đang hoạt động", không liệt kê được
--      combo đã tắt. Chủ quán đọc TOÀN BỘ (kể cả đã tắt) để quản lý ở
--      /admin/combos. Ghi (tạo/sửa/xoá/đổi is_active) CHỈ chủ quán. ----
drop policy if exists "Public read active combos" on combos;
create policy "Public read active combos" on combos for select using (is_active = true);

drop policy if exists "Admin read combos" on combos;
create policy "Admin read combos" on combos for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin insert combos" on combos;
create policy "Admin insert combos" on combos for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update combos" on combos;
create policy "Admin update combos" on combos for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete combos" on combos;
create policy "Admin delete combos" on combos for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- combo_items: khách cần đọc được để xem "chi tiết combo gồm những món
--      nào" TRƯỚC khi thêm vào giỏ — nhưng CHỈ của combo ĐANG hiển thị (join
--      điều kiện is_active ngay trong policy, vì combo_items không có sẵn cột
--      is_active riêng). Chủ quán đọc/ghi toàn bộ để quản lý ở /admin/combos. ----
drop policy if exists "Public read combo_items of active combos" on combo_items;
create policy "Public read combo_items of active combos" on combo_items for select
  using (exists (select 1 from public.combos c where c.id = combo_items.combo_id and c.is_active = true));

drop policy if exists "Admin read combo_items" on combo_items;
create policy "Admin read combo_items" on combo_items for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin insert combo_items" on combo_items;
create policy "Admin insert combo_items" on combo_items for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update combo_items" on combo_items;
create policy "Admin update combo_items" on combo_items for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete combo_items" on combo_items;
create policy "Admin delete combo_items" on combo_items for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ============================================================================
-- Module 12 — Tối ưu vận hành, Tự động hoá Telegram & Quản lý tài chính
-- (Operational Optimization & Expense Tracking)
--
-- 3 phần độc lập, KHÔNG đụng tới logic đặt món/KDS/thanh toán đã có:
--   (A) `expenses` — sổ chi phí quán (nguyên liệu/điện nước/lương/khác), CHỈ
--       chủ quán CRUD, dùng để tính "Lợi nhuận gộp = Doanh thu - Chi phí" ở
--       Dashboard (xem analytics.service.ts#getDashboardSummary).
--   (B) `menu_items.auto_reset_daily` — cờ đánh dấu món nào được TỰ ĐỘNG bật
--       lại "còn hàng" mỗi sáng qua Vercel Cron (xem
--       app/api/cron/reset-availability/route.ts) — dành cho món chỉ hết
--       theo NGÀY (vd bánh làm sẵn số lượng có hạn), khác món hết hẳn vì lý
--       do khác mà nhân viên tắt thủ công qua "Hết món nhanh" (Module 2) và
--       muốn giữ tắt qua ngày hôm sau.
--   (C) Báo cáo cuối ngày qua Telegram (xem
--       app/api/reports/daily-telegram/route.ts) — CHỈ ĐỌC dữ liệu đã có sẵn
--       (orders/expenses), không thêm bảng nào cho phần này.
-- ============================================================================

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12, 0) not null check (amount > 0),
  category text not null check (category in ('ingredient', 'utility', 'salary', 'other')),
  note text,
  expense_date date not null default current_date,
  -- Nullable + on delete set null (giống order_items.combo_id ở Module 11):
  -- xoá tài khoản nhân viên đã từng nhập chi phí không được phép xoá luôn
  -- lịch sử chi phí đó.
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_expense_date on expenses (expense_date);

alter table expenses enable row level security;

-- ---- expenses: CHỈ chủ quán CRUD (số liệu chi phí/lợi nhuận là dữ liệu
--      nhạy cảm, khác menu/tồn kho vốn cho cả staff xem) ----
drop policy if exists "Admin read expenses" on expenses;
create policy "Admin read expenses" on expenses for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin insert expenses" on expenses;
create policy "Admin insert expenses" on expenses for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update expenses" on expenses;
create policy "Admin update expenses" on expenses for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete expenses" on expenses;
create policy "Admin delete expenses" on expenses for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- menu_items.auto_reset_daily: mặc định true (hầu hết món nên tự bật
--      lại mỗi sáng trừ khi chủ quán chủ động tắt cho món đặc biệt) ----
alter table menu_items add column if not exists auto_reset_daily boolean not null default true;

-- ============================================================================
-- Module 14 — Chủ quán sửa/đóng ca hộ nhân viên (Admin Shift Correction)
--
-- Bổ sung cho Module 8: chủ quán trước đây CHỈ xem được lịch sử ca (SELECT),
-- không có cách nào tự sửa nếu nhân viên quên bấm "Kết thúc ca" hoặc đếm nhầm
-- tiền lúc chốt ca — phải can thiệp trực tiếp vào Supabase Dashboard. 2 tình
-- huống cụ thể cần xử lý:
--   (A) Nhân viên quên "Kết thúc ca" trước khi ra về -> chủ quán "Đóng ca hộ"
--       (dùng LẠI ĐÚNG RPC close_shift bên dưới, chỉ mở rộng quyền gọi + thêm
--       tham số lý do tuỳ chọn).
--   (B) Nhân viên gõ nhầm tiền đầu ca, hoặc đếm nhầm tiền lúc chốt ca -> chủ
--       quán "Sửa số liệu" (initial_cash/final_cash) trực tiếp qua UPDATE
--       thường (không cần RPC riêng, đã có policy admin bên dưới).
-- CỐ Ý KHÔNG cho sửa total_revenue_cash/total_revenue_transfer bằng bất kỳ
-- đường nào (kể cả UPDATE thường) — 2 cột này LUÔN được suy ra lại đúng từ
-- `orders` mỗi lần đóng ca, sửa tay sẽ làm sai lệch số liệu gốc; nếu số đó
-- sai, nguyên nhân thật nằm ở dữ liệu `orders`, không phải ở bảng `shifts`.
-- ============================================================================

-- ---- shifts: 3 cột audit — ghi lại CÓ ai (chủ quán) từng can thiệp tay vào
--      ca này hay không, vì sao, và lúc nào — để nhân viên/chủ quán khác xem
--      lại lịch sử không bị bất ngờ khi thấy số liệu khác với lúc họ tự chốt
--      ca. NULL nghĩa là ca này chưa từng bị admin chỉnh sửa. ----
alter table shifts add column if not exists admin_note text;
alter table shifts add column if not exists edited_by uuid references profiles (id);
alter table shifts add column if not exists edited_at timestamptz;

-- ---- shifts: cho phép chủ quán UPDATE bất kỳ ca nào (không chỉ ca của
--      chính mình) — policy PERMISSIVE này ghép OR với "Staff update own
--      shift" đã có từ Module 8 (không thay thế), nên nhân viên vẫn tự sửa
--      ca của mình bình thường, chủ quán có thêm quyền sửa ca của MỌI nhân
--      viên. Giống hệt mức tin cậy đã chấp nhận ở các bảng admin-only khác
--      (zones, combos, expenses...) — chủ quán vốn đã có toàn quyền dữ liệu
--      trong ứng dụng này. ----
drop policy if exists "Admin update any shift" on shifts;
create policy "Admin update any shift" on shifts for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---- close_shift: thêm tham số p_admin_note (mặc định null, KHÔNG đổi cách
--      gọi hiện có của nhân viên) — khi chủ quán gọi kèm lý do, hàm ghi luôn
--      admin_note/edited_by/edited_at NGUYÊN TỬ trong CÙNG câu UPDATE tính
--      doanh thu, không cần round-trip thứ 2. Đổi số lượng tham số nên phải
--      DROP hàm cũ trước rồi mới CREATE lại — "create or replace" không thay
--      thế được hàm có chữ ký (số tham số) khác, sẽ tạo thêm 1 overload gây
--      mơ hồ khi gọi. ----
drop function if exists public.close_shift(uuid, numeric);

create or replace function public.close_shift(
  p_shift_id uuid,
  p_final_cash numeric,
  p_admin_note text default null
)
returns table (
  id uuid,
  staff_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  initial_cash numeric,
  final_cash numeric,
  total_revenue_cash numeric,
  total_revenue_transfer numeric,
  status text,
  created_at timestamptz,
  admin_note text,
  edited_by uuid,
  edited_at timestamptz,
  order_count bigint
)
language plpgsql
as $$
begin
  return query
  update public.shifts s
  set
    end_time = now(),
    final_cash = p_final_cash,
    total_revenue_cash = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'cash'
    ), 0),
    total_revenue_transfer = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'transfer'
    ), 0),
    status = 'closed',
    admin_note = case when p_admin_note is not null then p_admin_note else s.admin_note end,
    edited_by = case when p_admin_note is not null then auth.uid() else s.edited_by end,
    edited_at = case when p_admin_note is not null then now() else s.edited_at end
  where s.id = p_shift_id
    and s.status = 'active'
  returning
    s.id, s.staff_id, s.start_time, s.end_time, s.initial_cash, s.final_cash,
    s.total_revenue_cash, s.total_revenue_transfer, s.status, s.created_at,
    s.admin_note, s.edited_by, s.edited_at,
    (select count(*) from public.orders o2 where o2.shift_id = s.id and o2.payment_status = 'paid');
end;
$$;

-- ============================================================================
-- Module 13 — Sơ đồ Bàn theo Khu vực (Visual Floor Plan) & Đặt Mang đi
-- (Visual Floor Plan & Zones + Takeaway Orders)
--
-- 2 phần độc lập:
--   (A) `zones` + `tables.zone_id`/`tables.shape` — nhóm 15 bàn theo khu vực
--       thực tế của quán (Tầng 1, Tầng 2, Sân vườn...) để `/staff/tables`
--       hiển thị dạng tab theo khu vực thay vì 1 lưới phẳng, kèm mã màu
--       trạng thái trực quan hơn (xem phần đổi enum bên dưới).
--   (B) `orders.order_type`/`pickup_time`/`customer_name`/`customer_phone` +
--       `table_id` chuyển sang NULLABLE — cho phép tạo đơn "mang đi" không
--       gắn với bàn nào, mở rộng kênh bán ngoài phục vụ khách ngồi tại bàn.
--
-- ĐỔI ENUM TRẠNG THÁI BÀN (thay đổi LỚN NHẤT của module này): 3 giá trị cũ
-- ('empty'/'ordering'/'paid', Module 2) -> 4 giá trị mới
-- ('available'/'occupied'/'payment_pending'/'needs_cleaning') để khớp đúng
-- vòng đời vận hành thực tế: thêm bước "cần dọn dẹp" sau khi thu tiền thay vì
-- coi bàn trống ngay lập tức. Ánh xạ giá trị cũ -> mới:
--   empty -> available, ordering -> occupied, paid -> payment_pending.
-- Vòng đời mới đầy đủ: available -(khách gửi đơn)-> occupied
--   -(khách yêu cầu thanh toán, staff_calls type 'checkout')-> payment_pending
--   -(nhân viên xác nhận đã thu tiền, markOrdersPaid)-> needs_cleaning
--   -(nhân viên bấm 1 chạm sau khi dọn xong)-> available.
-- Toàn bộ điểm code gọi updateTableStatus() đã cập nhật theo enum mới (xem
-- services/order.service.ts, services/staffCall.service.ts).
-- ============================================================================

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table zones enable row level security;

-- ---- zones: đọc công khai (giống categories — chỉ là tên khu vực, không
--      nhạy cảm); CRUD chỉ chủ quán, quản lý ở /admin/zones. ----
drop policy if exists "Public read zones" on zones;
create policy "Public read zones" on zones for select using (true);

drop policy if exists "Admin insert zones" on zones;
create policy "Admin insert zones" on zones for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin update zones" on zones;
create policy "Admin update zones" on zones for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin delete zones" on zones;
create policy "Admin delete zones" on zones for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---- tables: thêm zone_id (khu vực, NULLABLE — bàn chưa gán khu vực vẫn
--      hiển thị bình thường ở tab "Tất cả") + shape (hình dạng bàn, CHỈ ảnh
--      hưởng hiển thị, không ảnh hưởng nghiệp vụ). `on delete set null`: xoá
--      1 khu vực KHÔNG xoá theo các bàn thuộc khu vực đó, chỉ gỡ gán (bàn trở
--      về "chưa gán khu vực"). ----
alter table tables add column if not exists zone_id uuid references zones (id) on delete set null;
alter table tables add column if not exists shape text not null default 'square';

alter table tables drop constraint if exists tables_shape_check;
alter table tables add constraint tables_shape_check
  check (shape in ('square', 'round', 'rectangle'));

-- Gỡ CHECK constraint CŨ (chỉ cho phép 'empty'/'ordering'/'paid') TRƯỚC khi
-- migrate dữ liệu — nếu update dữ liệu trước khi gỡ constraint cũ, chính các
-- câu update bên dưới (gán giá trị 'available'/'payment_pending' MỚI) sẽ vi
-- phạm ràng buộc CŨ đang còn hiệu lực và tự lỗi ngay tại bước update. An toàn
-- để chạy lại nhiều lần: "drop if exists" không lỗi khi constraint đã được gỡ
-- từ lần chạy trước, và mỗi dòng update chỉ khớp đúng giá trị CŨ nên không
-- còn tác dụng sau lần chạy đầu tiên.
alter table tables drop constraint if exists tables_status_check;

update tables set status = 'available' where status = 'empty';
update tables set status = 'occupied' where status = 'ordering';
update tables set status = 'payment_pending' where status = 'paid';

alter table tables add constraint tables_status_check
  check (status in ('available', 'occupied', 'payment_pending', 'needs_cleaning'));
alter table tables alter column status set default 'available';

-- ---- tables: khách (anon) được set 'occupied' khi gửi đơn tại bàn VÀ
--      'payment_pending' khi yêu cầu thanh toán (staff_calls type
--      'checkout', xem staffCall.service.createStaffCall) — MỌI trạng thái
--      khác (đặc biệt 'available'/'needs_cleaning', chỉ nhân viên mới được
--      set) chỉ nhân viên/chủ quán mới được phép qua policy "Staff update
--      tables" (Module 2, không đổi). Thay thế policy "Anon set table
--      ordering" (Module 2, chỉ cho phép mỗi 'ordering'). ----
drop policy if exists "Anon set table ordering" on tables;
drop policy if exists "Anon set table status" on tables;
create policy "Anon set table status" on tables for update
  using (true)
  with check (status in ('occupied', 'payment_pending'));

-- ---- orders: hỗ trợ đơn "mang đi" (order_type = 'takeaway') KHÔNG gắn bàn
--      nào (table_id null) — khác đơn "tại bàn" (order_type = 'dine_in',
--      mặc định, GIỮ NGUYÊN hành vi cũ) luôn bắt buộc có table_id. ----
alter table orders add column if not exists order_type text not null default 'dine_in';
alter table orders add column if not exists pickup_time timestamptz;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;

alter table orders drop constraint if exists orders_order_type_check;
alter table orders add constraint orders_order_type_check
  check (order_type in ('dine_in', 'takeaway'));

alter table orders alter column table_id drop not null;

-- Ràng buộc toàn vẹn: đơn "tại bàn" LUÔN phải có bàn; đơn "mang đi" thì
-- không bắt buộc — đảm bảo ở tầng database thay vì chỉ tin tưởng client gửi
-- đúng (xem order.service.createOrder).
alter table orders drop constraint if exists orders_table_id_required_check;
alter table orders add constraint orders_table_id_required_check
  check ((order_type = 'dine_in' and table_id is not null) or (order_type = 'takeaway'));

-- Bật Realtime (Supabase Dashboard > Database > Replication), hoặc chạy:
-- alter publication supabase_realtime add table tables, menu_items, orders, order_items, staff_calls, feedbacks, ingredients, shifts, promotions, combos, combo_items, expenses, zones, system_settings, reservations;

-- ============================================================================
-- Module 15 — Tự động xác nhận Thanh toán VietQR qua Webhook PayOS
--            (Realtime Automated Payment)
--
-- Trước Module này: khách chọn "Chuyển khoản" ở CheckoutSheet chỉ hiện 1 mã
-- VietQR TĨNH (ảnh dựng từ NEXT_PUBLIC_VIETQR_*) — khách chuyển khoản xong
-- vẫn phải BẤM "Yêu cầu thanh toán" để gọi nhân viên ra xác nhận bằng mắt
-- (PaymentConfirmSheet, markOrdersPaid). Module 15 thêm 1 đường THỨ 2, TỰ
-- ĐỘNG: PayOS tạo 1 mã VietQR ĐỘNG gắn đúng số tiền + mã đơn duy nhất, và khi
-- PayOS xác nhận tiền đã vào tài khoản (gọi webhook), hệ thống TỰ đánh dấu đã
-- thanh toán — không cần nhân viên thao tác gì. Đường thanh toán CŨ (chuyển
-- khoản thủ công do nhân viên xác nhận bằng mắt) VẪN GIỮ NGUYÊN — 2 đường
-- cùng tồn tại song song, khách/nhân viên có thể dùng đường nào cũng được.
--
-- PHẠM VI (quyết định thiết kế có chủ đích): CHỈ áp dụng cho đơn TẠI BÀN
-- (order_type = 'dine_in', table_id khác null) — đơn "mang đi" hiện KHÔNG đi
-- qua CheckoutSheet/PaymentConfirmSheet (xem ghi chú order.service.createOrder
-- Module 13), nên tự động hoá thanh toán mang đi nằm ngoài phạm vi lần này,
-- không phải thiếu sót.
--
-- 1 MÃ PAYOS = CẢ BÀN, KHÔNG PHẢI 1 ĐƠN: 1 bàn có thể có NHIỀU đơn đang hoạt
-- động cùng lúc (khách gọi nhiều lượt món) và khách chỉ thanh toán DỒN 1 lần
-- khi rời quán — giống hệt luồng thủ công (markOrdersPaid nhận danh sách
-- NHIỀU order id của 1 bàn, không phải 1 đơn lẻ). Vì vậy: đơn "neo" (đơn gần
-- nhất của bàn, `latestOrderId` phía client) giữ `payment_order_code`/
-- `payment_link_id` (đúng 1 mã PayOS = đúng 1 dòng, khớp ràng buộc UNIQUE),
-- nhưng số tiền gửi PayOS = TỔNG mọi đơn đang hoạt động của bàn, và khi
-- webhook xác nhận, RPC `confirm_payos_payment` bên dưới thanh toán CẢ BÀN
-- (mọi đơn payment_status='unpaid' của table_id đó) trong CÙNG 1 câu UPDATE
-- nguyên tử — không chỉ riêng đơn neo.
--
-- KHÔNG GẮN shift_id: webhook PayOS gọi từ server, KHÔNG có phiên đăng nhập
-- nhân viên nào để tra "ca đang mở của ai" (khác markOrdersPaid, nơi
-- auth.uid() xác định được nhân viên đang thao tác) — cố ý để `shift_id =
-- null` cho các đơn thanh toán tự động này, đúng tinh thần đã áp dụng ở
-- Module 8 ("không chặn/không suy đoán, tiền vẫn được ghi nhận đầy đủ").
-- Hệ quả: doanh thu qua PayOS sẽ KHÔNG xuất hiện trong báo cáo CHỐT CA ở
-- `/admin/shifts` (vốn lọc theo shift_id) — vẫn xuất hiện đầy đủ ở
-- Dashboard/Thống kê tổng (không lọc theo shift_id). Đã ghi rõ trong
-- claude/tinh-trang-du-an.md để không bị hiểu nhầm là mất doanh thu.
-- ============================================================================

-- ---- orders: đổi tên giá trị 'transfer' -> 'vietqr' cho payment_method, và
--      thêm 'failed'/'refunded' cho payment_status — theo ĐÚNG thứ tự an
--      toàn đã rút ra từ Module 13 (bảng tables): PHẢI drop constraint CŨ
--      trước, rồi mới migrate dữ liệu, rồi mới add constraint MỚI — migrate
--      trước khi drop sẽ làm chính câu UPDATE bên dưới vi phạm constraint cũ
--      đang còn hiệu lực. ----
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders drop constraint if exists orders_payment_status_check;

update orders set payment_method = 'vietqr' where payment_method = 'transfer';

alter table orders add constraint orders_payment_method_check
  check (payment_method in ('cash', 'vietqr'));
alter table orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'failed', 'refunded'));

-- LƯU Ý QUAN TRỌNG (không phải bug): sau đổi tên này, 'vietqr' dùng chung
-- cho CẢ 2 trường hợp — (1) nhân viên xác nhận thủ công bằng mắt ở
-- PaymentConfirmSheet, và (2) PayOS xác nhận tự động qua webhook. Muốn phân
-- biệt lại 2 trường hợp này sau này (vd để kiểm toán) KHÔNG cần thêm cột
-- mới: đơn có payment_order_code khác null chính là đơn được PayOS xác nhận
-- tự động, đơn payment_method='vietqr' nhưng payment_order_code null là
-- nhân viên tự xác nhận thủ công.

-- ---- orders: 3 cột phục vụ tích hợp PayOS. Mỗi mã payment_order_code chỉ
--      gắn với ĐÚNG 1 đơn (đơn "neo" của cả bàn, xem giải thích ở trên) nên
--      UNIQUE — NULLABLE vì tuyệt đại đa số đơn (tiền mặt, hoặc chuyển khoản
--      thủ công) không bao giờ có giá trị ở 3 cột này. ----
alter table orders add column if not exists payment_order_code bigint unique;
alter table orders add column if not exists payment_link_id text;
alter table orders add column if not exists paid_at timestamptz;

-- ---- close_shift: đổi bộ lọc doanh thu chuyển khoản từ 'transfer' sang
--      'vietqr' cho khớp tên giá trị mới — CHỮ KÝ HÀM (số/kiểu tham số)
--      KHÔNG đổi so với bản Module 14 nên "create or replace" thay thế được
--      trực tiếp, không cần drop function trước (khác với 2 lần đổi CHỮ KÝ ở
--      Module 8 -> 14). ----
create or replace function public.close_shift(
  p_shift_id uuid,
  p_final_cash numeric,
  p_admin_note text default null
)
returns table (
  id uuid,
  staff_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  initial_cash numeric,
  final_cash numeric,
  total_revenue_cash numeric,
  total_revenue_transfer numeric,
  status text,
  created_at timestamptz,
  admin_note text,
  edited_by uuid,
  edited_at timestamptz,
  order_count bigint
)
language plpgsql
as $$
begin
  return query
  update public.shifts s
  set
    end_time = now(),
    final_cash = p_final_cash,
    total_revenue_cash = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'cash'
    ), 0),
    total_revenue_transfer = coalesce((
      select sum(o.total_amount) from public.orders o
      where o.shift_id = s.id and o.payment_status = 'paid' and o.payment_method = 'vietqr'
    ), 0),
    status = 'closed',
    admin_note = case when p_admin_note is not null then p_admin_note else s.admin_note end,
    edited_by = case when p_admin_note is not null then auth.uid() else s.edited_by end,
    edited_at = case when p_admin_note is not null then now() else s.edited_at end
  where s.id = p_shift_id
    and s.status = 'active'
  returning
    s.id, s.staff_id, s.start_time, s.end_time, s.initial_cash, s.final_cash,
    s.total_revenue_cash, s.total_revenue_transfer, s.status, s.created_at,
    s.admin_note, s.edited_by, s.edited_at,
    (select count(*) from public.orders o2 where o2.shift_id = s.id and o2.payment_status = 'paid');
end;
$$;

-- ---- confirm_payos_payment: hàm nguyên tử webhook gọi khi PayOS báo "đã
--      nhận tiền" — nhận vào mã đơn (orderCode) đã gửi PayOS lúc tạo link,
--      tìm ra BÀN của đơn neo giữ mã đó, rồi thanh toán CẢ BÀN (mọi đơn
--      payment_status='unpaid' còn active của đúng bàn này) trong 1 câu
--      UPDATE. Trả về 1 dòng / 1 đơn vừa được chốt (kèm customer_id/
--      total_amount) để phía webhook (TypeScript) tự cộng điểm thưởng cho
--      từng đơn — GIỐNG HỆT cách markOrdersPaid làm ở tầng client, chỉ khác
--      chỗ này chạy nguyên tử trong SQL vì được gọi bằng service-role key
--      (không có phiên đăng nhập/RLS nào để dựa vào).
--
--      AN TOÀN GỌI LẶP (idempotent): PayOS có thể gọi webhook nhiều lần cho
--      cùng 1 giao dịch (thử lại khi mạng lỗi...) — lần gọi ĐẦU đã chuyển
--      payment_status của các đơn liên quan sang 'paid', nên `where
--      payment_status = 'unpaid'` ở các lần gọi SAU tự nhiên không khớp dòng
--      nào -> trả về rỗng, phía webhook coi là "đã xử lý trước đó", không
--      cộng điểm/báo Telegram lần 2. ----
create or replace function public.confirm_payos_payment(p_order_code bigint)
returns table (
  order_id uuid,
  table_id uuid,
  table_number int,
  customer_id uuid,
  total_amount numeric
)
language plpgsql
as $$
declare
  v_table_id uuid;
begin
  select o.table_id into v_table_id
  from public.orders o
  where o.payment_order_code = p_order_code
  limit 1;

  -- Không tìm thấy đơn neo giữ mã này (vd PayOS gọi thử/ping webhook lúc
  -- cấu hình) — trả rỗng, phía webhook coi là bỏ qua an toàn, KHÔNG báo lỗi.
  if v_table_id is null then
    return;
  end if;

  return query
  update public.orders o
  set
    payment_status = 'paid',
    payment_method = 'vietqr',
    status = 'completed',
    paid_at = now()
  from public.tables t
  where o.table_id = v_table_id
    and o.payment_status = 'unpaid'
    and o.status in ('pending', 'preparing')
    and t.id = o.table_id
  returning o.id, o.table_id, t.table_number, o.customer_id, o.total_amount;
end;
$$;

-- ============================================================================
-- Module 17 — Cấu hình Linh hoạt Phương thức Thanh toán
-- (Dynamic Payment Settings)
--
-- Bài toán: trước module này, quán KHÔNG có cách nào tắt bớt 1 phương thức
-- thanh toán theo nhu cầu vận hành (vd tạm tắt PayOS lúc tài khoản PayOS gặp
-- sự cố, hoặc quán nhỏ chỉ muốn dùng tiền mặt + VietQR tĩnh, không cần tự
-- động hoá) — mọi phương thức (PayOS Module 15, VietQR tĩnh + tiền mặt Module
-- 1/2) đều LUÔN bật cứng trong code.
--
-- Bảng `system_settings` dùng kiểu "key/value" (KHÁC `shop_settings` — Module
-- 6, vốn là singleton 1-cột-1-cờ) vì đây là bảng cấu hình TỔNG QUÁT có thể mở
-- rộng thêm nhiều nhóm cấu hình khác trong tương lai (mỗi nhóm 1 `key`, giá
-- trị JSONB tự do) mà không cần `alter table` thêm cột mỗi lần — key duy nhất
-- đang dùng hiện tại là 'payment_config'.
--
-- CHỈ ẢNH HƯỞNG GIAO DIỆN client tự ẩn/hiện lựa chọn thanh toán — KHÔNG thêm
-- ràng buộc gì ở tầng RLS/RPC cho `orders.payment_method`: nếu admin vừa tắt
-- 1 phương thức TRONG LÚC khách đang xem sẵn màn hình thanh toán cũ, request
-- gửi lên vẫn được server chấp nhận bình thường (giống triết lý "không chặn
-- luồng thanh toán chính" đã áp dụng xuyên suốt dự án, vd Module 9/15) — đây
-- là công tắc ĐIỀU HƯỚNG vận hành, không phải công tắc BẢO MẬT.
-- ============================================================================

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed đúng 1 dòng cấu hình thanh toán, mặc định BẬT CẢ 4 (giữ nguyên hành vi
-- hiện có của quán cho tới khi chủ quán chủ động vào /admin/settings tắt bớt).
insert into system_settings (key, value) values (
  'payment_config',
  jsonb_build_object(
    'enable_payos', true,
    'enable_static_qr', true,
    'enable_cash', true,
    'enable_pay_at_table', true
  )
) on conflict (key) do nothing;

alter table system_settings enable row level security;

-- ---- system_settings: đọc CÔNG KHAI (kể cả khách anon chưa đăng nhập) vì
--      trang gọi món/thanh toán của khách (`/order/status`, KHÔNG đăng nhập)
--      cần đọc được cấu hình này để tự ẩn/hiện đúng phương thức — giống policy
--      "Public read categories/menu_items" đã có từ Module 1 (không khai báo
--      `to authenticated` nghĩa là áp dụng cho MỌI role, kể cả anon). CHỈ admin
--      được sửa — không cấp insert/delete qua ứng dụng, dòng 'payment_config'
--      đã được seed sẵn ở trên (giống shop_settings, Module 6). ----
drop policy if exists "Public read system_settings" on system_settings;
create policy "Public read system_settings" on system_settings for select using (true);

drop policy if exists "Admin update system_settings" on system_settings;
create policy "Admin update system_settings" on system_settings for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ============================================================================
-- Module 18 — Đặt bàn trước từ xa (Remote Table Reservations)
--
-- Bài toán: quán chưa có cách nào nhận đặt bàn TRƯỚC khi khách tới — mọi bàn
-- chỉ được biết tới khi khách đã quét QR tại chỗ (Module 1). Module này thêm
-- 1 kênh riêng, KHÔNG gắn với 1 bàn cụ thể ngay từ đầu (khác `?table=` của
-- Module 1): khách tự đặt qua link công khai `/dat-ban`, HOẶC nhân viên tạo hộ
-- ngay trong app khi khách gọi điện tới quán.
--
-- Quyết định vận hành đã thống nhất với người dùng (KHÔNG làm ở lần này):
-- quán xác nhận đặt bàn THỦ CÔNG (nhân viên gọi lại), KHÔNG yêu cầu đặt cọc,
-- và khách KHÔNG có link riêng để tự xem/huỷ lượt đặt của mình — toàn bộ việc
-- đó nhân viên xử lý qua điện thoại. Vì vậy bảng này CHỈ cần policy INSERT
-- công khai (giống staff_calls/feedbacks) — không có SELECT/UPDATE nào cho
-- anon.
--
-- 2 nguồn tạo ra 1 lượt đặt, phân biệt bằng `created_by`:
--   - Khách tự đặt qua `/dat-ban` (anon): `created_by = null`, status khởi
--     tạo LUÔN là 'pending' — quán còn phải gọi lại xác nhận.
--   - Nhân viên tạo hộ khi khách gọi điện (`/staff/reservations`): `created_by`
--     = tài khoản đang đăng nhập, status khởi tạo LUÔN là 'confirmed' — nhân
--     viên đang nói chuyện trực tiếp với khách nên không cần bước gọi lại.
-- 2 policy INSERT tách riêng (permissive, OR với nhau — giống cách
-- "Admin update any shift" ghép với "Staff update own shift" ở Module 14) để
-- RLS tự chặn: 1 client ẩn danh không có cách nào tự đặt `created_by` thành 1
-- tài khoản nhân viên để bỏ qua bước xác nhận.
--
-- CỐ Ý KHÔNG đổi enum trạng thái bàn (`tables.status`) hay thêm ràng buộc gì
-- vào luồng đặt món hiện có — gán bàn cho 1 lượt đặt (`table_id`) chỉ là
-- THÔNG TIN THAM KHẢO hiển thị đè lên sơ đồ bàn (badge, xem TableCard.tsx),
-- không đổi màu/trạng thái bàn: bàn vẫn tự chuyển 'occupied' đúng lúc khách
-- gửi đơn gọi món đầu tiên (createOrder, Module 1/13), không cần sửa gì ở đó.
-- ============================================================================

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  party_size int not null check (party_size > 0),
  reservation_time timestamptz not null,
  note text,
  -- Nullable + on delete set null (giống order_items.combo_id ở Module 11):
  -- gán bàn chỉ là thông tin tham khảo hiển thị trên sơ đồ bàn, không phải
  -- ràng buộc nghiệp vụ — xoá bàn (hiếm khi xảy ra) không được phép kéo theo
  -- xoá lịch sử đặt bàn.
  table_id uuid references tables (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')),
  cancel_reason text,
  -- Nullable: null = khách tự đặt qua `/dat-ban` (anon); not null = nhân viên
  -- tạo hộ, xem ghi chú ở trên. on delete set null giống created_by của
  -- expenses (Module 12) — xoá tài khoản nhân viên không được xoá lịch sử.
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_reservation_time on reservations (reservation_time);

alter table reservations enable row level security;

-- ---- reservations: KHÔNG có policy SELECT/UPDATE nào cho anon — khách
--      không tự xem/sửa/huỷ lượt đặt của mình qua bất kỳ đường nào (đã thống
--      nhất với người dùng), toàn bộ do nhân viên/chủ quán xử lý qua điện
--      thoại + `/staff/reservations`. ----
drop policy if exists "Public insert reservations" on reservations;
create policy "Public insert reservations" on reservations for insert
  with check (created_by is null and status = 'pending' and table_id is null);

drop policy if exists "Staff insert reservations" on reservations;
create policy "Staff insert reservations" on reservations for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'staff') and created_by = auth.uid());

drop policy if exists "Staff read reservations" on reservations;
create policy "Staff read reservations" on reservations for select
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "Staff update reservations" on reservations;
create policy "Staff update reservations" on reservations for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- ============================================================================
-- Module 19 — Đặt Mua Hàng Giao Tận Nơi Từ Xa (Remote Delivery / Shipping)
--
-- Bài toán: 2 kênh bán hàng hiện có (Module 1 "tại bàn" và Module 13 "mang đi
-- tự tới lấy") đều giả định khách TỚI QUÁN. Module này thêm kênh thứ 3: khách
-- đặt hàng từ xa qua link công khai `/delivery`, KHÔNG cần tới quán, quán giao
-- tận nơi — cần thêm địa chỉ/người nhận, phí ship tự tính, và 1 vòng đời trạng
-- thái giao hàng RIÊNG (khác `orders.status`, xem giải thích ngay dưới).
--
-- TÁI SỬ DỤNG TỐI ĐA hạ tầng đã có (đúng yêu cầu người dùng): đơn delivery vẫn
-- là 1 dòng trong `orders` (order_type = 'delivery', table_id = null — giống
-- 'takeaway'), vẫn insert order_items y hệt, vẫn qua đúng RPC
-- `confirm_payos_payment`/webhook PayOS đã có (Module 15, mở rộng bên dưới),
-- vẫn dùng bảng `system_settings` kiểu key/value (Module 17) cho cấu hình phí
-- ship, và vẫn "bắn" Telegram qua đúng route `/api/notify/telegram` (Module 7).
--
-- QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG — payment_method 'cod' MỚI, NHƯNG PayOS vẫn
-- dùng LẠI 'vietqr' (KHÔNG thêm 'payos_qr' như tên gợi ý ban đầu): mọi báo cáo/
-- lọc doanh thu hiện có (close_shift, analytics.service.ts) đều lọc theo
-- payment_method = 'vietqr' cho "chuyển khoản" — thêm 1 giá trị mới riêng cho
-- delivery sẽ làm doanh thu PayOS của đơn giao hàng BIẾN MẤT khỏi các báo cáo
-- đó một cách âm thầm. 'vietqr' dùng chung cho CẢ 3 trường hợp giờ đây (nhân
-- viên xác nhận tay, PayOS tại bàn, PayOS giao hàng) — vẫn phân biệt được nhờ
-- payment_order_code khác null (xem ghi chú tương tự ở Module 15).
--
-- QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG — TÁCH `delivery_status` khỏi `orders.status`:
-- với đơn tại bàn, "thanh toán xong" ĐỒNG NGHĨA "đơn hoàn tất" (khách trả tiền
-- rồi về). Với đơn giao hàng KHÔNG như vậy — khách thanh toán qua PayOS TRƯỚC
-- khi hàng rời quán, nhưng đơn còn phải qua Bếp làm -> shipper giao -> khách
-- nhận mới thực sự "xong". Nếu dùng chung `orders.status` (vốn quyết định đơn
-- có còn hiện ở KDS/"đang hoạt động" hay không), việc PayOS xác nhận thanh
-- toán sẽ vô tình đá luôn đơn ra khỏi hàng đợi bếp. Vì vậy:
--   - `orders.status` (pending/preparing/completed/cancelled) VẪN đúng vai trò
--     cũ: bếp/bar dùng để biết còn món cần làm hay không (order_items lồng
--     trong đơn), KHÔNG bị PayOS đụng vào đối với đơn delivery.
--   - `delivery_status` (cột MỚI, RIÊNG) là vòng đời giao hàng mà khách theo
--     dõi ở `/delivery/track/[id]` và nhân viên thao tác ở `/staff/orders`:
--     'pending' (mới tạo) -> 'preparing' (đã gửi bếp) -> 'delivering' (shipper
--     đang giao) -> 'completed' (khách đã nhận — CHÍNH THỜI ĐIỂM NÀY mới coi
--     là "xong" với đơn COD: payment_status chuyển 'paid' ở bước này, xem
--     delivery.service.ts#updateDeliveryStatus) hoặc 'cancelled'.
-- ============================================================================

-- ---- orders: 6 cột mới cho đơn giao hàng — mọi cột đều NULLABLE/có default vì
--      chỉ áp dụng cho order_type = 'delivery', vô nghĩa với dine_in/takeaway. ----
alter table orders add column if not exists recipient_name text;
alter table orders add column if not exists recipient_phone text;
alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists delivery_notes text;
alter table orders add column if not exists shipping_fee numeric(12, 0) not null default 0 check (shipping_fee >= 0);
alter table orders add column if not exists delivery_status text not null default 'pending';

alter table orders drop constraint if exists orders_delivery_status_check;
alter table orders add constraint orders_delivery_status_check
  check (delivery_status in ('pending', 'preparing', 'delivering', 'completed', 'cancelled'));

-- ---- order_type: thêm 'delivery' — GIỮ NGUYÊN 'dine_in'/'takeaway' cũ. ----
alter table orders drop constraint if exists orders_order_type_check;
alter table orders add constraint orders_order_type_check
  check (order_type in ('dine_in', 'takeaway', 'delivery'));

-- ---- table_id vẫn bắt buộc CHỈ với dine_in — 'takeaway' và 'delivery' đều
--      không gắn bàn nào (đã drop not null từ Module 13, chỉ cần nới constraint
--      kiểm tra toàn vẹn cho khớp giá trị order_type mới). ----
alter table orders drop constraint if exists orders_table_id_required_check;
alter table orders add constraint orders_table_id_required_check
  check ((order_type = 'dine_in' and table_id is not null) or (order_type in ('takeaway', 'delivery')));

-- ---- payment_method: thêm 'cod' (thanh toán tiền mặt khi nhận hàng) — GIỮ
--      NGUYÊN 'cash'/'vietqr' cũ, xem giải thích "vietqr dùng chung" ở trên. ----
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('cash', 'vietqr', 'cod'));

create index if not exists idx_orders_order_type on orders (order_type);
create index if not exists idx_orders_delivery_status on orders (delivery_status);

-- ---- system_settings: seed key mới 'delivery_config' (kiểu key/value đã có
--      từ Module 17) — bật sẵn cả giao hàng lẫn COD, phí ship/ngưỡng freeship
--      là số gợi ý ban đầu, chủ quán tự chỉnh ở `/admin/settings`. ----
insert into system_settings (key, value) values (
  'delivery_config',
  jsonb_build_object(
    'enable_delivery', true,
    'enable_cod', true,
    'base_shipping_fee', 15000,
    'free_shipping_threshold', 150000,
    'max_delivery_distance_km', 10
  )
) on conflict (key) do nothing;
-- Policy đọc/ghi DÙNG CHUNG "Public read system_settings"/"Admin update
-- system_settings" đã tạo ở Module 17 (áp dụng cho MỌI dòng của bảng, không
-- lọc theo key) — không cần policy mới.

-- ---- confirm_payos_payment: viết lại để thêm nhánh đơn giao hàng (Module
--      19), KHÔNG đổi chữ ký hàm (vẫn nhận đúng 1 p_order_code, trả cùng 1
--      kiểu bảng như Module 15) nên "create or replace" thay thế trực tiếp.
--
--      SỬA 1 LỖI TIỀM ẨN CỦA BẢN CŨ nhân dịp viết lại: bản Module 15 coi
--      "v_table_id is null" là dấu hiệu DUY NHẤT của "không tìm thấy đơn neo"
--      — đúng với đơn dine_in (table_id luôn khác null) nhưng SẼ SAI với đơn
--      delivery/takeaway (table_id luôn là null MỘT CÁCH HỢP LỆ). Bản mới dùng
--      biến `FOUND` (Postgres tự set sau `select ... into`) để phân biệt đúng
--      "không có dòng nào khớp" với "có dòng khớp nhưng table_id vốn dĩ null".
--
--      NHÁNH DELIVERY: CHỈ chốt payment_status/payment_method/paid_at của
--      ĐÚNG 1 đơn giữ mã orderCode đó (khác nhánh dine_in gộp CẢ BÀN) — mỗi mã
--      PayOS của đơn giao hàng vốn đã đại diện đúng 1 đơn (xem
--      delivery.service.ts#createDeliveryOrder, không có khái niệm "gộp nhiều
--      đơn cùng 1 lượt giao" như nhiều lượt gọi món của 1 bàn). CỐ Ý KHÔNG đụng
--      `status`/`delivery_status` — xem giải thích "TÁCH delivery_status" ở
--      đầu Module 19: đơn giao hàng thanh toán xong vẫn phải qua đúng vòng đời
--      bếp làm -> giao -> nhận, webhook chỉ xác nhận ĐÃ CÓ TIỀN, không phải ĐÃ
--      XONG. `table_id`/`table_number` trả về null cho nhánh này — phía
--      webhook (TypeScript) dùng đúng tín hiệu `table_id === null` để biết đây
--      là đơn giao hàng và tự tra thêm thông tin người nhận/địa chỉ để bắn
--      Telegram, xem route.ts. ----
create or replace function public.confirm_payos_payment(p_order_code bigint)
returns table (
  order_id uuid,
  table_id uuid,
  table_number int,
  customer_id uuid,
  total_amount numeric
)
language plpgsql
as $$
declare
  v_table_id uuid;
  v_order_type text;
begin
  select o.table_id, o.order_type into v_table_id, v_order_type
  from public.orders o
  where o.payment_order_code = p_order_code
  limit 1;

  -- Không tìm thấy đơn neo giữ mã này (vd PayOS gọi thử/ping webhook lúc cấu
  -- hình) — trả rỗng, phía webhook coi là bỏ qua an toàn, KHÔNG báo lỗi. Dùng
  -- FOUND thay vì "v_table_id is null" — xem giải thích "SỬA 1 LỖI TIỀM ẨN" ở trên.
  if not found then
    return;
  end if;

  if v_order_type = 'delivery' then
    return query
    update public.orders o
    set
      payment_status = 'paid',
      payment_method = 'vietqr',
      paid_at = now()
    where o.payment_order_code = p_order_code
      and o.payment_status = 'unpaid'
    returning o.id, null::uuid, null::int, o.customer_id, o.total_amount;
    return;
  end if;

  if v_table_id is null then
    -- Đơn neo không gắn bàn nào nhưng KHÔNG phải delivery (vd dữ liệu cũ/bất
    -- thường) — không có "cả bàn" nào để gộp thanh toán, bỏ qua an toàn.
    return;
  end if;

  return query
  update public.orders o
  set
    payment_status = 'paid',
    payment_method = 'vietqr',
    status = 'completed',
    paid_at = now()
  from public.tables t
  where o.table_id = v_table_id
    and o.payment_status = 'unpaid'
    and o.status in ('pending', 'preparing')
    and t.id = o.table_id
  returning o.id, o.table_id, t.table_number, o.customer_id, o.total_amount;
end;
$$;
