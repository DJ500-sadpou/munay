-- =============================================================
-- Migración 00004 — Tabla de administradores + RLS policies.
--
-- Principio de seguridad desde el día 1:
--   - Lectura pública: solo `products` activos + sus `product_images`.
--   - Lectura pública: info básica de flash_codes activos y vigentes
--     (para mostrar la oferta en /flash/[code]).
--   - Escritura: SOLO service role (Edge Functions) o usuarios en `admins`.
--   - Datos privados (orders, payments, customers, point_transactions):
--     el usuario dueño puede leer los suyos; nadie más.
-- =============================================================

-- Tabla de admins (relación user_id → admin) ----------------
create table if not exists public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on table public.admins is 'Usuarios con permisos de administración (gestión de catálogo, órdenes, etc.).';

-- Helper: ¿el usuario actual es admin? ----------------------
-- Útil para policies. Retorna boolean.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid()
  );
$$;
comment on function public.is_admin is 'True si el usuario autenticado está en la tabla admins.';

-- =============================================================
-- Activar RLS en TODAS las tablas públicas
-- =============================================================

alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.inventory             enable row level security;
alter table public.flash_codes           enable row level security;
alter table public.flash_code_products   enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.payments              enable row level security;
alter table public.customers             enable row level security;
alter table public.point_transactions    enable row level security;
alter table public.admins                enable row level security;

-- =============================================================
-- PRODUCTS — catálogo público
-- =============================================================

-- Público (anon + auth) puede ver SOLO productos activos.
drop policy if exists "products: public read active" on public.products;
create policy "products: public read active"
  on public.products for select
  to anon, authenticated
  using (active = true);

-- Admins pueden ver todo (incluye inactivos).
drop policy if exists "products: admin read all" on public.products;
create policy "products: admin read all"
  on public.products for select
  to authenticated
  using (public.is_admin());

-- Solo service role o admins pueden escribir.
drop policy if exists "products: admin write" on public.products;
create policy "products: admin write"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- PRODUCT_IMAGES — lectura pública si el producto está activo
-- =============================================================
drop policy if exists "product_images: public read" on public.product_images;
create policy "product_images: public read"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.active = true
    )
  );

drop policy if exists "product_images: admin write" on public.product_images;
create policy "product_images: admin write"
  on public.product_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- INVENTORY — no público (no exponer stock exacto al cliente).
-- Solo admins y service role.
-- =============================================================
drop policy if exists "inventory: admin all" on public.inventory;
create policy "inventory: admin all"
  on public.inventory for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- FLASH_CODES — lectura pública limitada (solo vigentes y activos).
-- No exponer max_uses ni uses_count al cliente final
-- (se filtra en el SELECT del frontend; aquí permitimos SELECT
-- para que el cliente pueda validar el código, pero el Edge Function
-- es quien realmente decide si aplica el descuento).
-- =============================================================
drop policy if exists "flash_codes: public read active and in window" on public.flash_codes;
create policy "flash_codes: public read active and in window"
  on public.flash_codes for select
  to anon, authenticated
  using (
    active = true
    and now() between starts_at and ends_at
  );

drop policy if exists "flash_codes: admin all" on public.flash_codes;
create policy "flash_codes: admin all"
  on public.flash_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "flash_code_products: admin all" on public.flash_code_products;
create policy "flash_code_products: admin all"
  on public.flash_code_products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- ORDERS — el usuario dueño lee las suyas; admins todas.
-- Escritura: solo service role (Edge Function crea la orden).
-- =============================================================
drop policy if exists "orders: owner read" on public.orders;
create policy "orders: owner read"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No permitimos INSERT/UPDATE desde el cliente anónimo.
-- La orden la crea un Server Action / Edge Function con service role key.
drop policy if exists "orders: admin write" on public.orders;
create policy "orders: admin write"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- ORDER_ITEMS — mismo modelo que orders.
-- =============================================================
drop policy if exists "order_items: owner read via order" on public.order_items;
create policy "order_items: owner read via order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "order_items: admin write" on public.order_items;
create policy "order_items: admin write"
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- PAYMENTS — solo admins. El cliente ve el estado de su orden,
-- no el detalle del pago.
-- =============================================================
drop policy if exists "payments: admin all" on public.payments;
create policy "payments: admin all"
  on public.payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- CUSTOMERS — el usuario lee su propio registro; admins todos.
-- =============================================================
drop policy if exists "customers: self read" on public.customers;
create policy "customers: self read"
  on public.customers for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "customers: admin write" on public.customers;
create policy "customers: admin write"
  on public.customers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- POINT_TRANSACTIONS — el usuario lee su ledger; admins todos.
-- Escritura solo vía Edge Function (service role).
-- =============================================================
drop policy if exists "point_transactions: owner read" on public.point_transactions;
create policy "point_transactions: owner read"
  on public.point_transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = point_transactions.customer_id
      and (c.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "point_transactions: admin write" on public.point_transactions;
create policy "point_transactions: admin write"
  on public.point_transactions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- ADMINS — un usuario solo puede saber si él mismo es admin.
-- (No puede listar a otros admins.)
-- =============================================================
drop policy if exists "admins: self read" on public.admins;
create policy "admins: self read"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());
