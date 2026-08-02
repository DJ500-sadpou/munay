-- 00024_categorias_marcas.sql
-- Categorías de producto (vocabulario fijo) + tabla de marcas administrables.

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (char_length(slug) between 1 and 100),
  nombre     text not null check (char_length(nombre) between 1 and 100),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
-- [FIX R2/R3] unique index case-insensitive: text UNIQUE es case-sensitive,
-- "Nike" y "nike" pasarían ambos; con lower(nombre) se evita el dup.
create unique index if not exists idx_brands_nombre_lower on public.brands (lower(nombre));

-- [FIX R2/R3] CHECK del vocabulario fijo (defense-in-depth; los NULL de
-- productos pre-clasificación siguen pasando).
alter table public.products
  add column if not exists categoria text
    constraint products_categoria_check
      check (categoria is null or categoria in ('chaquetas','tops','pantalones','zapatillas','bolsos','vestidos','accesorios')),
  add column if not exists marca_id uuid references public.brands(id) on delete set null;

create index if not exists idx_products_categoria on public.products(categoria);
create index if not exists idx_products_marca on public.products(marca_id);
