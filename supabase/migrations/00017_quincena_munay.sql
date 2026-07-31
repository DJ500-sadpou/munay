-- =============================================================
-- Migración 00017 — Quincena MUNAY: enum rename + categoria_tematica
--
-- Cambios:
--   1. Renombrar valor del enum campaign_type: 'week_sale' → 'quincena'
--   2. Añadir columna categoria_tematica a flash_campaigns
--   3. Actualizar vistas para incluir el nuevo campo
-- =============================================================

-- Paso 1: Renombrar valor del enum (requiere crear nuevo tipo, migrar, dropear viejo)
-- Nota: ALTER TYPE ... RENAME VALUE solo está disponible desde Postgres 10+
-- pero como estamos en Postgres 16, podemos usarlo directamente.
do $$
begin
  if exists (select 1 from pg_enum where enumlabel = 'week_sale') then
    alter type campaign_type rename value 'week_sale' to 'quincena';
  end if;
end $$;

-- Paso 2: Añadir columna categoria_tematica
alter table public.flash_campaigns
  add column if not exists categoria_tematica text;

comment on column public.flash_campaigns.categoria_tematica is
  'Temática de la edición quincenal. Ej: Nuevos ingresos, Segunda mano curada, Denim';

-- Paso 3: Recrear vista active_campaigns para incluir categoria_tematica
-- Nota: DROP + CREATE en vez de CREATE OR REPLACE porque cambia el número de columnas (fc.* incluye la nueva columna)
drop view if exists public.active_campaigns cascade;
create view public.active_campaigns as
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

-- Paso 4: Recrear vista all_campaigns_with_status para incluir categoria_tematica
drop view if exists public.all_campaigns_with_status cascade;
create view public.all_campaigns_with_status as
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
