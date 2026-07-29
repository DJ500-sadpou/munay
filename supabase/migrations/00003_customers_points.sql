-- =============================================================
-- Migración 00003 — Clientes y fidelidad (puntos tipo "ledger").
--
-- Modelo: en lugar de un campo `points_balance` en `customers`,
-- usamos una tabla `point_transactions` que registra CADA movimiento
-- (earn / redeem / adjust). El saldo actual = SUM(points).
--
-- Ventajas:
--   - Auditabilidad total (qué orden generó puntos, qué orden los redimió).
--   - No hay race conditions al acreditar/redimir concurrentemente.
--   - Permite reversiones (adjust negativo) sin perder historia.
--
-- Reglas de negocio (se aplican en Edge Functions, no en SQL):
--   earn:   puntos = floor(total_cents / 100)  (1 punto por $1)
--   redeem: 10 puntos = $1 → discount_cents = floor(points / 10) * 100
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'point_tx_type') then
    create type point_tx_type as enum ('earn', 'redeem', 'adjust');
  end if;
end $$;

-- customers --------------------------------------------------
-- Un customer puede existir SIN user_id (guest con email only).
-- El UNIQUE en email evita duplicados.
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  email       text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_customers_user on public.customers(user_id);

-- point_transactions (ledger) --------------------------------
-- type='earn'   → points > 0, order_id = orden que generó los puntos
-- type='redeem' → points < 0 (negativo), order_id = orden donde se usaron
-- type='adjust' → points +/- arbitrario, order_id null (manual admin)
create table if not exists public.point_transactions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  type         point_tx_type not null,
  points       integer not null,
  note         text,
  created_at   timestamptz not null default now(),
  -- Validaciones por tipo
  check (
    (type = 'earn'   and points > 0)
    or (type = 'redeem' and points < 0)
    or (type = 'adjust')
  )
);
create index if not exists idx_point_tx_customer on public.point_transactions(customer_id, created_at desc);
create index if not exists idx_point_tx_order on public.point_transactions(order_id) where order_id is not null;

-- Vista: saldo de puntos por cliente -------------------------
-- Útil para mostrar en UI y para validar redenciones.
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

comment on table public.customers is 'Clientes (con o sin login). email único.';
comment on table public.point_transactions is 'Ledger de puntos. earn=positivo, redeem=negativo, adjust=ambos.';
comment on view public.customer_point_balances is 'Saldo actual de puntos = SUM(points) por cliente.';
