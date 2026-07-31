-- =============================================================
-- Migración 00016 — Marketplace P2P
--
-- Modelo:
--   - user_listings: productos publicados por usuarios
--     (pendientes de verificación por admin)
--   - Estado: pending → verified → published | rejected
--   - Badge de verificación en Turquesa para listings verified
-- =============================================================

create table if not exists public.user_listings (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null references public.users(id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 200),
  description       text,
  category          text not null,                          -- 'chaquetas' | 'camisetas' | etc.
  condition         text not null check (condition in ('new', 'like_new', 'good', 'fair')),
  price_cents       integer not null check (price_cents >= 0),
  currency          text not null default 'USD',
  images            jsonb not null default '[]',            -- array de URLs
  size              text,                                   -- 'S' | 'M' | 'L' | 'XL' | '36' | '38' | etc.
  brand             text,
  status            text not null default 'pending' check (status in ('pending', 'verified', 'published', 'rejected')),
  verified_at       timestamptz,                            -- cuándo lo verificó el admin
  verified_by       text references public.users(id),       -- admin que verificó
  rejection_reason  text,                                   -- motivo de rechazo (opcional)
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_user_listings_user on public.user_listings(user_id, created_at desc);
create index if not exists idx_user_listings_status on public.user_listings(status);
create index if not exists idx_user_listings_published on public.user_listings(status, created_at desc)
  where status in ('verified', 'published') and active = true;

comment on table public.user_listings is 'Productos publicados por usuarios (Marketplace P2P)';

-- Vista: listings publicados/verificados (para el catálogo P2P)
create or replace view public.published_listings as
select
  ul.*,
  u.email as seller_email,
  substring(u.email from '^[^@]+') as seller_name
from public.user_listings ul
join public.users u on u.id = ul.user_id
where ul.status in ('verified', 'published')
  and ul.active = true
order by ul.created_at desc;

comment on view public.published_listings is 'Listings publicados/verificados visibles en el marketplace';
