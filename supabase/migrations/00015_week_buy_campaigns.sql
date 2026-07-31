-- =============================================================
-- Migración 00015 — Week Buy (Compra Semanal por Categoría)
--
-- Modelo:
--   - week_buy_campaigns: campaña semanal con categoría objetivo,
--     fecha de cierre, descuento progresivo, meta de compromisos
--   - week_buy_commitments: usuarios comprometidos a comprar
--     durante la campaña (con categoría seleccionada)
-- =============================================================

create table if not exists public.week_buy_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null,                       -- 'chaquetas' | 'camisetas' | 'pantalones' | etc.
  title               text not null,                        -- 'Week Buy: Chaquetas'
  description         text,
  close_at            timestamptz not null,                 -- cuándo cierra la campaña
  discount_percent    integer not null default 15 check (discount_percent between 0 and 100),
  min_commitments     integer not null default 20,          -- meta mínima de compromisos
  commitments_count   integer not null default 0 check (commitments_count >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  check (close_at > created_at)
);

create index if not exists idx_week_buy_active
  on public.week_buy_campaigns(active, close_at);

create table if not exists public.week_buy_commitments (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.week_buy_campaigns(id) on delete cascade,
  user_id           text not null,                          -- Clerk user ID
  email             text not null,
  notified          boolean not null default false,          -- ya se le notificó?
  created_at        timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists idx_week_buy_commitments_campaign
  on public.week_buy_commitments(campaign_id);

create index if not exists idx_week_buy_commitments_user
  on public.week_buy_commitments(user_id);

comment on table public.week_buy_campaigns is 'Campañas Week Buy — oferta semanal por categoría con descuento progresivo';
comment on table public.week_buy_commitments is 'Usuarios comprometidos a comprar durante una semana específica';

-- Vista: campaña activa con info de progreso
create or replace view public.active_week_buy as
select
  wbc.*,
  extract(epoch from (wbc.close_at - now()))::bigint as seconds_remaining,
  case
    when wbc.commitments_count >= wbc.min_commitments then 'goal_reached'
    else 'collecting'
  end as progress_status,
  round((wbc.commitments_count::numeric / nullif(wbc.min_commitments, 0)) * 100)::integer as progress_percent
from public.week_buy_campaigns wbc
where wbc.active = true
  and wbc.close_at > now()
order by wbc.close_at asc;

comment on view public.active_week_buy is 'Campaña Week Buy activa con tiempo restante y progreso de compromisos';
