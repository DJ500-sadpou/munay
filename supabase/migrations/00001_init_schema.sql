-- =============================================================
-- Migración 00001 — Esquema base: productos, imágenes, inventario,
-- flash codes.
-- Proyecto: Munay — Ropa nueva y de segunda (Ibarra, Ecuador)
-- Stack: Supabase Postgres + RLS
-- =============================================================

-- Extensions -------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums ------------------------------------------------------
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
end $$;

-- products ---------------------------------------------------
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

-- product_images --------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id, sort);

-- inventory (1:1 con products) ------------------------------
create table if not exists public.inventory (
  product_id  uuid primary key references public.products(id) on delete cascade,
  stock       integer not null default 0 check (stock >= 0),
  reserved    integer not null default 0 check (reserved >= 0),
  check (reserved <= stock),
  updated_at  timestamptz not null default now()
);

-- flash_codes -----------------------------------------------
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
    or
    (type = 'unlock')
  )
);
create index if not exists idx_flash_codes_active_window on public.flash_codes(active, starts_at, ends_at);

-- flash_code_products (para type='unlock': qué productos libera) --
create table if not exists public.flash_code_products (
  code        text not null references public.flash_codes(code) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  primary key (code, product_id)
);

-- Comments (documentación visible en Supabase Dashboard) ----
comment on table public.products is 'Catálogo público de prendas (nuevas y usadas).';
comment on table public.product_images is 'Imágenes por producto, ordenadas por sort.';
comment on table public.inventory is 'Stock y unidades reservadas (no confirmadas) por producto.';
comment on table public.flash_codes is 'Códigos de oferta flash: discount (% o monto fijo) o unlock (pieza oculta).';
comment on table public.flash_code_products is 'Productos desbloqueados por un código type=unlock.';
comment on column public.products.price_cents is 'Precio en centavos (integer). 1800 = $18.00 USD.';
comment on column public.flash_codes.uses_count is 'Incrementar atómicamente en backend (Edge Function) respetando max_uses.';
