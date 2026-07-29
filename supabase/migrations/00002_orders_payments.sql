-- =============================================================
-- Migración 00002 — Órdenes y pagos.
-- Una orden agrupa los items que el cliente quiere comprar.
-- Un pago es la transacción con la pasarela (Kushki/PayPhone/PayPal).
-- Una orden puede tener múltiples intentos de pago (reintentos).
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type payment_provider as enum ('kushki', 'payphone', 'paypal', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'authorized', 'captured', 'failed', 'refunded');
  end if;
end $$;

-- orders -----------------------------------------------------
-- user_id es nullable porque permitimos guest checkout.
-- customer_email se guarda SIEMPRE (para envío y puntos).
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  customer_email    text not null,
  status            order_status not null default 'pending',
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  discount_cents    integer not null default 0 check (discount_cents >= 0),
  points_redeemed   integer not null default 0 check (points_redeemed >= 0),
  total_cents       integer not null check (total_cents >= 0),
  -- Snapshot de la dirección de envío al momento de pagar.
  shipping_name     text,
  shipping_address  text,
  shipping_city     text,
  shipping_province text,
  shipping_phone    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Validación: el total debe ser consistente con subtotal - discount.
  check (total_cents = (subtotal_cents - discount_cents))
);
create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_email on public.orders(customer_email, created_at desc);
create index if not exists idx_orders_status on public.orders(status, created_at desc);

-- order_items ------------------------------------------------
-- unit_price_cents es un SNAPSHOT del precio al momento de comprar
-- (no se afecta por cambios posteriores al catálogo).
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

-- payments ---------------------------------------------------
-- Una orden puede tener varios payments (reintentos).
-- provider_ref es el ID que devuelve la pasarela (ej. Kushki ticketNumber).
-- raw guarda el payload completo del webhook para auditoría.
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
create index if not exists idx_payments_provider_ref on public.payments(provider, provider_ref) where provider_ref is not null;

-- Trigger: updated_at automático en orders -------------------
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

-- Comments ---------------------------------------------------
comment on table public.orders is 'Órdenes de compra. user_id es null para guest checkout.';
comment on table public.order_items is 'Items por orden. unit_price_cents es snapshot del precio al comprar.';
comment on table public.payments is 'Transacciones de pago (1 orden → N intentos). raw = payload del webhook.';
comment on column public.orders.points_redeemed is 'Puntos usados como descuento (10 pts = $1 = 100 cents de discount).';
