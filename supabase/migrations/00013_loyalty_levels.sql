-- =============================================================
-- Migración 00013 — Niveles de fidelidad (Bronce/Plata/Oro/Andino)
--
-- Modelo:
--   - loyalty_levels: catálogo de niveles (bronce, plata, oro, andino)
--   - users: se añade columna level_id (opcional, default = bronce)
--
-- Reglas:
--   Bronce: 0 pts, sin early access, color: warm-gray
--   Plata:  500 pts, 6h early access, color: turquesa
--   Oro:    2000 pts, 12h early access, color: terracota
--   Andino: 5000 pts, 24h early access, color: cacao + turquesa
-- =============================================================

-- loyalty_levels
create table if not exists public.loyalty_levels (
  id                 serial primary key,
  name               text not null unique,
  min_points         integer not null,
  early_access_hours integer not null default 0,
  color_token        text not null   -- 'warm-gray', 'turquesa', 'terracota', 'cacao-turquesa'
);

-- Niveles por defecto (idempotente)
insert into public.loyalty_levels (name, min_points, early_access_hours, color_token) values
  ('bronce',  0,     0,  'warm-gray'),
  ('plata',   500,   6,  'turquesa'),
  ('oro',     2000,  12, 'terracota'),
  ('andino',  5000,  24, 'cacao-turquesa')
on conflict (name) do nothing;

-- Añadir level_id a users
alter table public.users add column if not exists level_id integer
  references public.loyalty_levels(id)
  default (select id from public.loyalty_levels where name = 'bronce');

-- Vista: nivel actual del usuario según saldo de puntos
-- Útil para determinar el nivel sin tener que actualizar level_id en cada tx
create or replace view public.user_levels as
select
  u.id as user_id,
  u.email,
  coalesce(
    (select ll.id from public.loyalty_levels ll
     where coalesce(cp.balance, 0) >= ll.min_points
     order by ll.min_points desc
     limit 1),
    (select id from public.loyalty_levels where name = 'bronce')
  ) as level_id,
  coalesce(cp.balance, 0) as points_balance
from public.users u
left join public.customers c on c.user_id = u.id
left join public.customer_point_balances cp on cp.customer_id = c.id;

comment on table public.loyalty_levels is 'Niveles de fidelidad: Bronce → Plata → Oro → Andino (5000 pts máx)';
comment on view public.user_levels is 'Nivel actual de cada usuario según saldo de puntos acumulados';
