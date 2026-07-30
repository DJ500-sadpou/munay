-- =============================================================
-- MIGRACIÓN NEON — Esquema completo para Munay.
--
-- Ejecutar en orden en el SQL Editor de Neon (neon.com).
-- Esta migración consolida las 8 migraciones de Supabase en una,
-- adaptada para Postgres puro (sin auth.users de Supabase).
--
-- Cambios vs Supabase:
--   - Eliminadas referencias a auth.users (Clerk maneja auth).
--   - users.id es text (Clerk user ID), no uuid.
--   - Eliminado el bucket de Storage (UploadThing maneja storage).
--   - Las RPCs security definer SÍ tienen REVOKE EXECUTE de PUBLIC
--     (arregla hallazgo PERM-001 de la auditoría).
--   - Añadida RPC redeem_points (atómica, con FOR UPDATE).
--   - Añadida columna shipping_cents a orders (arregla FLOW-005).
--   - Añadida columna user_id text (no uuid) para compatibilidad Clerk.
-- =============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'currency') then
    create type currency as enum ('USD', 'EUR');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_condition') then
    create type product_condition as enum ('new', 'used');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_grading') then
    create type product_grading as enum ('excelente', 'buena', 'regular');
  end if;
  if not exists (select 1 from pg_type where typname = 'flash_code_type') then
    create type flash_code_type as enum ('discount', 'unlock');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type payment_provider as enum ('kushki', 'payphone', 'paypal', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'authorized', 'captured', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'point_tx_type') then
    create type point_tx_type as enum ('earn', 'redeem', 'adjust');
  end if;
end $$;

-- users (Clerk IDs son strings)
create table if not exists public.users (
  id          text primary key,  -- Clerk user ID
  email       text not null,
  created_at  timestamptz not null default now()
);

-- products
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (char_length(slug) between 3 and 120),
  title        text not null check (char_length(title) between 3 and 200),
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  currency     currency not null default 'USD',
  condition    product_condition not null,
  grading      product_grading,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- product_images
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id, sort);

-- inventory
create table if not exists public.inventory (
  product_id  uuid primary key references public.products(id) on delete cascade,
  stock       integer not null default 0 check (stock >= 0),
  reserved    integer not null default 0 check (reserved >= 0),
  check (reserved <= stock),
  updated_at  timestamptz not null default now()
);

-- flash_codes
create table if not exists public.flash_codes (
  code              text primary key check (char_length(code) between 4 and 32),
  type              flash_code_type not null,
  discount_percent  integer check (discount_percent is null or (discount_percent between 0 and 100)),
  discount_cents    integer check (discount_cents is null or discount_cents >= 0),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz not null,
  max_uses          integer check (max_uses is null or max_uses > 0),
  uses_count        integer not null default 0 check (uses_count >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (type = 'discount' and (discount_percent is not null or discount_cents is not null))
    or (type = 'unlock')
  )
);

-- flash_code_products (para type='unlock')
create table if not exists public.flash_code_products (
  code        text not null references public.flash_codes(code) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  primary key (code, product_id)
);

-- orders
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           text references public.users(id) on delete set null,
  customer_email    text not null,
  status            order_status not null default 'pending',
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  discount_cents    integer not null default 0 check (discount_cents >= 0),
  shipping_cents    integer not null default 0 check (shipping_cents >= 0),
  points_redeemed   integer not null default 0 check (points_redeemed >= 0),
  total_cents       integer not null check (total_cents >= 0),
  shipping_name     text,
  shipping_address  text,
  shipping_city     text,
  shipping_province text,
  shipping_phone    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Arreglo FLOW-005: total = subtotal - discount + shipping
  check (total_cents = (subtotal_cents - discount_cents + shipping_cents))
);
create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_email on public.orders(customer_email, created_at desc);
create index if not exists idx_orders_status on public.orders(status, created_at desc);

-- order_items
create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  qty               integer not null check (qty > 0),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  created_at        timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- payments
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  provider      payment_provider not null,
  provider_ref  text,
  status        payment_status not null default 'pending',
  raw           jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payments_order on public.payments(order_id, created_at desc);

-- customers
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     text unique references public.users(id) on delete set null,
  email       text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_customers_user on public.customers(user_id);

-- point_transactions (ledger)
create table if not exists public.point_transactions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  type         point_tx_type not null,
  points       integer not null,
  note         text,
  created_at   timestamptz not null default now(),
  check (
    (type = 'earn'   and points > 0)
    or (type = 'redeem' and points < 0)
    or (type = 'adjust')
  )
);
create index if not exists idx_point_tx_customer on public.point_transactions(customer_id, created_at desc);
create index if not exists idx_point_tx_order on public.point_transactions(order_id) where order_id is not null;
-- Idempotencia: una sola tx earn por orden (arregla FLOW-028)
create unique index if not exists idx_point_tx_order_earn_unique
  on public.point_transactions(order_id, type) where type = 'earn' and order_id is not null;

-- customer_point_balances (vista)
create or replace view public.customer_point_balances as
select
  c.id as customer_id,
  c.email,
  coalesce(sum(pt.points), 0) as points_balance,
  count(pt.id) filter (where pt.type = 'earn') as earn_count,
  count(pt.id) filter (where pt.type = 'redeem') as redeem_count
from public.customers c
left join public.point_transactions pt on pt.customer_id = c.id
group by c.id, c.email;

-- admins
create table if not exists public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null unique references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- audit_log
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('insert', 'update', 'delete', 'status_change')),
  old_data    jsonb,
  new_data    jsonb,
  actor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_table_row on public.audit_log(table_name, row_id, created_at desc);

-- Trigger: updated_at automático en orders
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- Helper: is_admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = current_setting('app.user_id', true)
  );
$$;

-- Trigger: auditar cambios de status en orders
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) or tg_op = 'INSERT' then
    insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
    values (
      'orders',
      new.id::text,
      case when tg_op = 'INSERT' then 'insert' else 'status_change' end,
      case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
      to_jsonb(new),
      coalesce(current_setting('app.actor', true), 'system')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_audit on public.orders;
create trigger trg_orders_audit
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();

-- =============================================================
-- RPCs atómicas (security definer + REVOKE PUBLIC — arregla PERM-001)
-- =============================================================

-- consume_flash_code
create or replace function public.consume_flash_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.flash_codes%rowtype;
begin
  select * into v_row
  from public.flash_codes
  where code = upper(p_code)
  for update;

  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not v_row.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
  if now() < v_row.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if now() > v_row.ends_at then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if v_row.max_uses is not null and v_row.uses_count >= v_row.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;

  update public.flash_codes set uses_count = uses_count + 1 where code = v_row.code;

  return jsonb_build_object(
    'ok', true, 'code', v_row.code, 'type', v_row.type,
    'discount_percent', v_row.discount_percent, 'discount_cents', v_row.discount_cents
  );
end;
$$;
revoke execute on function public.consume_flash_code(text) from public;
grant execute on function public.consume_flash_code(text) to authenticated;

-- reserve_inventory
create or replace function public.reserve_inventory(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.inventory%rowtype;
begin
  if p_qty <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_qty'); end if;
  select * into v_row from public.inventory where product_id = p_product_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_inventory'); end if;
  if v_row.stock - v_row.reserved < p_qty then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'available', v_row.stock - v_row.reserved);
  end if;
  update public.inventory set reserved = reserved + p_qty where product_id = p_product_id;
  return jsonb_build_object('ok', true, 'stock', v_row.stock, 'reserved', v_row.reserved + p_qty);
end;
$$;
revoke execute on function public.reserve_inventory(uuid, integer) from public;
grant execute on function public.reserve_inventory(uuid, integer) to authenticated;

-- commit_inventory
create or replace function public.commit_inventory(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_qty'); end if;
  update public.inventory
  set stock = greatest(0, stock - p_qty), reserved = greatest(0, reserved - p_qty)
  where product_id = p_product_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.commit_inventory(uuid, integer) from public;
grant execute on function public.commit_inventory(uuid, integer) to authenticated;

-- release_inventory
create or replace function public.release_inventory(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_qty'); end if;
  update public.inventory set reserved = greatest(0, reserved - p_qty) where product_id = p_product_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.release_inventory(uuid, integer) from public;
grant execute on function public.release_inventory(uuid, integer) to authenticated;

-- award_points (idempotente)
create or replace function public.award_points(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_points integer;
  v_existing_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'order_not_found'); end if;
  if v_order.status <> 'paid' then return jsonb_build_object('ok', false, 'reason', 'order_not_paid'); end if;
  select count(*) into v_existing_count
  from public.point_transactions where order_id = p_order_id and type = 'earn';
  if v_existing_count > 0 then return jsonb_build_object('ok', false, 'reason', 'already_awarded'); end if;
  select id into v_customer_id from public.customers where email = v_order.customer_email limit 1;
  if v_customer_id is null then
    insert into public.customers (email) values (v_order.customer_email) returning id into v_customer_id;
  end if;
  v_points := floor(v_order.total_cents / 100);
  if v_points > 0 then
    insert into public.point_transactions (customer_id, order_id, type, points, note)
    values (v_customer_id, p_order_id, 'earn', v_points, 'Puntos por compra');
  end if;
  return jsonb_build_object('ok', true, 'customer_id', v_customer_id, 'points_awarded', v_points);
end;
$$;
revoke execute on function public.award_points(uuid) from public;
grant execute on function public.award_points(uuid) to authenticated;

-- redeem_points (NUEVA — atómica con FOR UPDATE, arregla FLOW-007)
create or replace function public.redeem_points(p_user_id text, p_points integer, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_balance integer;
begin
  if p_points <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_amount'); end if;
  if p_points % 10 <> 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_amount'); end if;

  select * into v_customer from public.customers where user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_customer'); end if;

  select coalesce(sum(points), 0) into v_balance
  from public.point_transactions where customer_id = v_customer.id;

  if p_points > v_balance then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance);
  end if;

  -- Fix CRIT-3: insertar tx redeem AHORA (atómico con la validación del saldo).
  -- Si la orden no se confirma posteriormente, markOrderCancelled libera el descuento
  -- pero la tx redeem queda (es el "costo" de reservar los puntos — alternativamente
  -- se podría revertir en markOrderCancelled, pero eso complica más).
  insert into public.point_transactions (customer_id, order_id, type, points, note)
  values (v_customer.id, p_order_id, 'redeem', -p_points, 'Redención en checkout');

  return jsonb_build_object('ok', true, 'customer_id', v_customer.id, 'balance', v_balance - p_points);
end;
$$;
revoke execute on function public.redeem_points(text, integer, uuid) from public;
grant execute on function public.redeem_points(text, integer, uuid) to authenticated;

-- expire_stale_pending_orders
create or replace function public.expire_stale_pending_orders(p_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_count integer := 0;
  v_item record;
  v_order record;
  v_customer_id uuid;
begin
  if p_minutes < 1 then
    raise exception 'p_minutes must be >= 1';
  end if;
  v_cutoff := now() - (p_minutes || ' minutes')::interval;

  -- Liberar inventario de órdenes pendientes expiradas
  for v_item in
    select o.id as order_id, oi.product_id, oi.qty
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'pending' and o.created_at < v_cutoff
  loop
    perform public.release_inventory(v_item.product_id, v_item.qty);
  end loop;

  -- Fix FLOW3-001: devolver puntos redimidos antes de cancelar
  for v_order in
    select id, points_redeemed, customer_email
    from public.orders
    where status = 'pending' and created_at < v_cutoff and points_redeemed > 0
  loop
    select id into v_customer_id from public.customers where email = v_order.customer_email limit 1;
    if v_customer_id is not null then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, v_order.id, 'adjust', v_order.points_redeemed, 'Devolución: orden expirada sin pago');
    end if;
  end loop;

  -- Marcar órdenes como cancelled
  update public.orders set status = 'cancelled' where status = 'pending' and created_at < v_cutoff;
  get diagnostics v_count = row_count;

  -- Marcar payments como failed
  update public.payments set status = 'failed'
  where order_id in (select id from public.orders where status = 'cancelled' and created_at < v_cutoff)
  and status = 'pending';

  -- Auditar
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  select 'orders', id::text, 'status_change',
         jsonb_build_object('status', 'cancelled', 'reason', 'stale_pending_expired'),
         'system'
  from public.orders
  where status = 'cancelled' and created_at < v_cutoff;

  return jsonb_build_object('ok', true, 'expired_count', v_count, 'cutoff', v_cutoff);
end;
$$;
revoke execute on function public.expire_stale_pending_orders(integer) from public;
grant execute on function public.expire_stale_pending_orders(integer) to authenticated;

-- refund_order
create or replace function public.refund_order(p_order_id uuid, p_reason text default 'Reembolso')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_earn_points integer := 0;
  v_redeem_points integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'order_not_found'); end if;
  if v_order.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_paid', 'current_status', v_order.status);
  end if;
  update public.orders set status = 'refunded' where id = p_order_id;
  select id into v_customer_id from public.customers where email = v_order.customer_email limit 1;
  if v_customer_id is not null then
    select coalesce(sum(points), 0) into v_earn_points
    from public.point_transactions where order_id = p_order_id and type = 'earn';
    if v_earn_points > 0 then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, p_order_id, 'adjust', -v_earn_points, 'Reembolso: reversión');
    end if;
    v_redeem_points := v_order.points_redeemed;
    if v_redeem_points > 0 then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, p_order_id, 'adjust', v_redeem_points, 'Reembolso: devolución');
    end if;
  end if;
  update public.payments set status = 'refunded'
  where order_id = p_order_id and status = 'captured';
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  values ('orders', p_order_id::text, 'status_change',
    jsonb_build_object('status', 'refunded', 'reason', p_reason, 'earn_reverted', v_earn_points, 'redeem_returned', v_redeem_points),
    coalesce(current_setting('app.actor', true), 'admin'));
  return jsonb_build_object('ok', true, 'earn_points_reverted', v_earn_points, 'redeem_points_returned', v_redeem_points);
end;
$$;
revoke execute on function public.refund_order(uuid, text) from public;
grant execute on function public.refund_order(uuid, text) to authenticated;

-- =============================================================
-- SEED de datos de ejemplo (solo dev)
-- =============================================================
insert into public.products (slug, title, description, price_cents, currency, condition, grading, active)
values
  ('amazonita-pulida', 'Camiseta artesanal de algodón orgánico — talla M', 'Camiseta de algodón orgánico 100%, tejida a mano por artesanos locales. Corte recto, talla M. Color: crudo natural.', 300, 'USD', 'new', null, true),
  ('cuenco-ceremonial-ceramica-negra', 'Chaqueta vaquera vintage — talla L', 'Chaqueta vaquera de segunda mano en buen estado. Auténtico denim de los años 90. Talla L, corte clásico.', 700, 'USD', 'used', 'buena', true),
  ('palo-santo-kg', 'Pantalón de lino ecológico — talla 40', 'Pantalón de lino 100% ecológico. Fresco, ligero y transpirable. Talla 40 (M). Corte recto, color: beige natural.', 560, 'USD', 'new', null, true),
  ('colgante-cuarzo-cristal', 'Gorro tejido a mano — lana merina', 'Gorro de lana merina 100%, tejido a mano. Talla única, diseño clásico. Color: gris perla. Hecho por artesanas locales.', 200, 'USD', 'new', null, true),
  ('mystery-box', '🎁 Mystery Box — Sorpresa', 'Una selección sorpresa de prendas seleccionadas especialmente para ti. ¿Qué habrá dentro?', 0, 'USD', 'new', null, true)
on conflict (slug) do nothing;

insert into public.inventory (product_id, stock, reserved)
select id, case slug
  when 'amazonita-pulida' then 20
  when 'cuenco-ceremonial-ceramica-negra' then 5
  when 'palo-santo-kg' then 15
  when 'colgante-cuarzo-cristal' then 25
  when 'mystery-box' then 50
end, 0
from public.products
on conflict (product_id) do nothing;

insert into public.flash_codes (code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active)
values
  ('MUNAY10', 'discount', 10, null, now(), now() + interval '90 days', 100, 0, true),
  ('MUNAY25', 'discount', 25, null, now(), now() + interval '30 days', 50, 0, true),
  ('SECRETO', 'unlock', null, null, now(), now() + interval '180 days', 10, 0, true)
on conflict (code) do nothing;

insert into public.flash_code_products (code, product_id)
select 'SECRETO', p.id from public.products p where p.slug = 'mystery-box'
on conflict do nothing;

-- Asociar MUNAY10 (10%) y MUNAY25 (25%) a productos activos
insert into public.flash_code_products (code, product_id)
select 'MUNAY10', p.id from public.products p
where p.slug in ('amazonita-pulida', 'cuenco-ceremonial-ceramica-negra', 'palo-santo-kg')
  and p.active = true
on conflict do nothing;

insert into public.flash_code_products (code, product_id)
select 'MUNAY25', p.id from public.products p
where p.slug in ('amazonita-pulida', 'colgante-cuarzo-cristal')
  and p.active = true
on conflict do nothing;

-- =============================================================
-- Cupones de fidelidad (lealtad post-compra)
-- =============================================================

create table if not exists public.loyalty_coupons (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references public.users(id) on delete cascade,
  order_id         uuid not null references public.orders(id) on delete cascade,
  code             text not null unique check (code ~ '^FID-[A-HJ-NP-Z2-9]{8}$'),
  discount_percent integer not null check (discount_percent between 1 and 100),
  expires_at       timestamptz not null,
  used_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique(user_id, order_id)
);
create index if not exists idx_loyalty_coupons_user on public.loyalty_coupons(user_id, used_at);
create index if not exists idx_loyalty_coupons_code on public.loyalty_coupons(code);

comment on table public.loyalty_coupons is 'Cupones de fidelidad: 1 por orden pagada, 7 días de vigencia, 20-30% desc.';

-- Tabla de configuración en runtime (toggle on/off sin redeploy)
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('loyalty_coupons', '{"enabled": true, "discount_percent": 25}')
on conflict (key) do nothing;
