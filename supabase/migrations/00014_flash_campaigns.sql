-- =============================================================
-- Migración 00014 — Campañas Flash / Week Sale
--
-- Modelo:
--   - flash_campaigns: campaña con fechas reales de inicio/fin
--   - flash_campaign_products: productos asociados a la campaña
--   - Calcula estado automático (pending / active / ended) según fechas
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'campaign_type') then
    create type campaign_type as enum ('flash', 'week_sale');
  end if;
end $$;

create table if not exists public.flash_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  type                campaign_type not null default 'flash',
  description         text,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  discount_percent    integer check (discount_percent is null or (discount_percent between 0 and 100)),
  points_multiplier   integer not null default 1 check (points_multiplier >= 1),
  max_uses            integer check (max_uses is null or max_uses > 0),
  uses_count          integer not null default 0 check (uses_count >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_flash_campaigns_active
  on public.flash_campaigns(active, starts_at, ends_at);

create table if not exists public.flash_campaign_products (
  campaign_id   uuid not null references public.flash_campaigns(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  primary key (campaign_id, product_id)
);

comment on table public.flash_campaigns is 'Campañas de ofertas flash / Quincena MUNAY con fechas reales';
comment on table public.flash_campaign_products is 'Productos asociados a cada campaña';

-- Vista: campañas activas en este momento
create or replace view public.active_campaigns as
select
  fc.*,
  (select count(*) from public.flash_campaign_products fcp where fcp.campaign_id = fc.id) as product_count,
  case
    when now() < fc.starts_at then 'pending'
    when now() > fc.ends_at then 'ended'
    else 'active'
  end as status,
  extract(epoch from (fc.ends_at - now()))::bigint as seconds_remaining
from public.flash_campaigns fc
where fc.active = true
  and fc.starts_at <= now()
  and fc.ends_at > now()
order by fc.ends_at asc;

comment on view public.active_campaigns is 'Campañas activas en este momento con tiempo restante calculado';

-- Vista: todas las campañas con estado calculado
create or replace view public.all_campaigns_with_status as
select
  fc.*,
  (select count(*) from public.flash_campaign_products fcp where fcp.campaign_id = fc.id) as product_count,
  case
    when not fc.active then 'inactive'
    when now() < fc.starts_at then 'pending'
    when now() > fc.ends_at then 'ended'
    else 'active'
  end as status
from public.flash_campaigns fc
order by fc.created_at desc;
