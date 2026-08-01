-- =============================================================
-- Migración 00023 — F0: Tabla settings + Evolución de tickets +
--                       RPC expire_stale_orders_v2 (cron único extendido)
--
-- Plan: PLAN_MODULOS_CUPONES_FLASH_TICKETS.md (F3.1 + F3.4, F0)
-- Aprobado por el usuario:
--   • Expiración de tickets: 72h (alineada con la ventana whatsapp
--     del RPC — NO 48h, decisión documentada en el plan Ronda 1).
--   • Cron ÚNICO extendido: NO se crea /api/cron/expire-tickets
--     separado; se extiende expire_stale_orders_v2 + la route
--     existente /api/cron/expire-orders (vercel.json no cambia).
--
-- Contenido:
--   A. Tabla `settings` (toggle auto_expire_tickets_enabled +
--      umbral cupón primera_compra) — un solo mecanismo key/value.
--   B. Evolución de `tickets` (misma tabla, sin duplicar):
--        ticket_numero, clerk_user_id, precio_total_cents,
--        descuento_aplicado, fecha_expiracion (+72h).
--      • CHECK de estado ampliado: + pendiente, expirado, confirmado.
--      • Secuencia ticket_numero_seq (0000-9999, CYCLE).
--      • Índice único parcial: no-colisión de números ACTIVOS.
--      • Backfill fecha_expiracion = created_at + 72h (idempotente).
--   C. RPC expire_stale_orders_v2 extendida:
--        • Nuevo parámetro p_process_whatsapp boolean DEFAULT true
--          (toggle real: si false, se saltan las ramas whatsapp).
--        • Rama whatsapp usa t.fecha_expiracion < now() como fuente
--          de verdad (NO created_at) — alineada a 72h.
--        • Marca tickets → 'expirado' en la MISMA corrida que libera
--          inventario (una sola liberación, idempotente por corrida).
--        • Selección única de órdenes objetivo por corrida (temp table
--          _target_orders) — evita divergencias entre pasos.
--
-- ⚠️ IMPORTANTE (firma de la RPC):
--   CREATE OR REPLACE con distinto número de parámetros crearía un
--   OVERLOAD nuevo y el cron seguiría resolviendo a la RPC vieja.
--   Por eso se DROPEA la firma (integer, integer) ANTES de crear la
--   nueva (integer, integer, boolean). La llamada del cron
--   `expire_stale_orders_v2(60, 72)` sigue funcionando (default true).
--
-- Compatible con Neon (Postgres 16). Idempotente. Transaccional.
-- =============================================================

begin;

-- ═══════════════════════════════════════════════════════════════
-- A. TABLA `settings` (F1.1 + F3.4 — toggle y umbral configurable)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is
  'Configuración key/value en runtime (sin redeploy). Claves: auto_expire_tickets_enabled, coupon_first_purchase_warning_threshold.';

insert into public.settings (key, value)
values
  ('auto_expire_tickets_enabled', 'true'),
  ('coupon_first_purchase_warning_threshold', '30')
on conflict (key) do nothing;

-- Rol app_user (idempotente — mismo patrón que 00020/00022/neon_roles_patch)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;

-- Permisos (patrón del proyecto: rol app_user, ver 00020).
-- [FIX 5R] Sin `delete`: el plan solo define getSetting/updateSetting
-- (upsert = insert + update); menos privilegio.
grant select, insert, update on public.settings to app_user;

-- ═══════════════════════════════════════════════════════════════
-- B. EVOLUCIÓN DE `tickets` (F3.1) — misma tabla, sin duplicar
-- ═══════════════════════════════════════════════════════════════

-- ── B1. Columnas de pedido ──
alter table public.tickets add column if not exists ticket_numero integer;
alter table public.tickets add column if not exists clerk_user_id text;
alter table public.tickets add column if not exists precio_total_cents integer;
alter table public.tickets add column if not exists descuento_aplicado jsonb;
alter table public.tickets add column if not exists fecha_expiracion timestamptz;

comment on column public.tickets.ticket_numero is
  'Número de ticket de pedido (4 dígitos vía ticket_numero_seq). NULL para tickets de soporte.';
comment on column public.tickets.clerk_user_id is
  'ID de Clerk del cliente que hizo el pedido (si aplica).';
comment on column public.tickets.precio_total_cents is
  'Total del pedido en centavos al momento del ticket.';
comment on column public.tickets.descuento_aplicado is
  'JSONB con el descuento aplicado (tipo + monto/pct).';
comment on column public.tickets.fecha_expiracion is
  'Vencimiento del ticket de pedido (created_at + 72h, alineado con la ventana whatsapp del RPC).';

-- ── B2. CHECK de estado ampliado (conserva estados de soporte) ──
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets add constraint tickets_status_check
  check (status in ('new', 'in_progress', 'completed', 'cancelled', 'pendiente', 'expirado', 'confirmado'));

-- ── B3. Secuencia de 4 dígitos (0000-9999, cicla) ──
create sequence if not exists public.ticket_numero_seq
  start 1 maxvalue 9999 cycle;

-- ── B4. Índice único parcial: garantía DB de no-colisión entre
--        tickets ACTIVOS (pendiente/confirmado). El retry (hasta 10
--        intentos) vive en la app; el índice respalda la unicidad. ──
create unique index if not exists tickets_numero_active_idx
  on public.tickets (ticket_numero)
  where status in ('pendiente', 'confirmado');

-- ── B5. Backfill fecha_expiracion (decisión aprobada: 72h) ──
--   Aplica SOLO a filas NULL; soporte incluido por simplicidad (no
--   tiene order_id, el RPC jamás las marca expirado).
update public.tickets
set fecha_expiracion = created_at + interval '72 hours'
where fecha_expiracion is null;

-- ── B6. Permisos (la app inserta/lee/actualiza tickets) ──
grant select, insert, update on public.tickets to app_user;
grant usage, select on sequence public.ticket_numero_seq to app_user;

-- ═══════════════════════════════════════════════════════════════
-- C. RPC EXTIENDIDA — cron único (F3.4)
-- ═══════════════════════════════════════════════════════════════

-- C0. DROP de la firma vieja (ver ⚠️ del header): sin esto, el cron
--     seguiría resolviendo al overload (integer, integer) viejo que
--     NO respeta el toggle ni marca tickets expirado.
drop function if exists public.expire_stale_orders_v2(integer, integer);

create or replace function public.expire_stale_orders_v2(
  p_minutes_standard integer default 60,
  p_max_hours_whatsapp integer default 72,
  p_process_whatsapp boolean default true
)
returns jsonb
language plpgsql
as $func$
declare
  v_cutoff_standard timestamptz;
  v_cutoff_whatsapp timestamptz;
  v_count integer := 0;
  v_tickets_expired integer := 0;
  v_item record;
  v_order record;
  v_customer_id uuid;
begin
  if p_minutes_standard < 1 then
    raise exception 'p_minutes_standard must be >= 1';
  end if;
  if p_max_hours_whatsapp < 1 then
    raise exception 'p_max_hours_whatsapp must be >= 1';
  end if;

  v_cutoff_standard := now() - (p_minutes_standard || ' minutes')::interval;
  v_cutoff_whatsapp := now() - (p_max_hours_whatsapp || ' hours')::interval;

  -- Selección ÚNICA de órdenes objetivo de esta corrida (idempotente).
  --   • Rama standard: órdenes sin ticket, vencidas a p_minutes_standard.
  --   • Rama whatsapp: SOLO si p_process_whatsapp=true; usa
  --     t.fecha_expiracion < now() como fuente de verdad (alineada a
  --     72h), NO created_at. [FIX 5R] COALESCE defensivo: si un ticket
  --     quedó con fecha_expiracion NULL (checkout legacy aún sin F3),
  --     cae al corte por created_at + 72h — equivalente a la semántica
  --     vieja y evita órdenes atrapadas forever (ni la rama standard ni
  --     la whatsapp las tomarían con NULL). Cualquier ticket con
  --     order_id cuenta (legacy 'new' + nuevo 'pendiente'); los de
  --     soporte no tienen order_id → jamás clasifican.
  --   DROP previo defensivo: permite re-llamadas en la misma transacción.
  drop table if exists pg_temp._target_orders;
  create temp table _target_orders on commit drop as
    select o.id
    from public.orders o
    where o.status = 'pending'
      and (
        (o.created_at < v_cutoff_standard and not exists (
          select 1 from public.tickets t where t.order_id = o.id
        ))
        or
        (p_process_whatsapp and exists (
          select 1 from public.tickets t
          where t.order_id = o.id
            and coalesce(t.fecha_expiracion, o.created_at + interval '72 hours') < now()
        ))
      );

  -- C1. Liberar inventario (una sola liberación por corrida)
  for v_item in
    select o.id as order_id, oi.product_id, oi.qty
    from _target_orders to_
    join public.orders o on o.id = to_.id
    join public.order_items oi on oi.order_id = o.id
  loop
    perform public.release_inventory(v_item.product_id, v_item.qty);
  end loop;

  -- C2. [F3.4] Marcar tickets de pedido → 'expirado' EN LA MISMA
  --     corrida que libera inventario (una sola liberación).
  --     Solo 'pendiente' (nuevo flujo) y 'new' (legacy checkout):
  --     los tickets de soporte no tienen order_id → nunca se tocan.
  update public.tickets t
  set status = 'expirado', updated_at = now()
  where t.order_id in (select id from _target_orders)
    and t.status in ('pendiente', 'new')
    and p_process_whatsapp;
  get diagnostics v_tickets_expired = row_count;

  -- C3. Devolver puntos redimidos antes de cancelar
  for v_order in
    select o.id, o.points_redeemed, o.customer_email
    from _target_orders to_
    join public.orders o on o.id = to_.id
    where o.points_redeemed > 0
  loop
    select id into v_customer_id from public.customers where email = v_order.customer_email limit 1;
    if v_customer_id is not null then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, v_order.id, 'adjust', v_order.points_redeemed, 'Devolución: orden expirada sin pago');
    end if;
  end loop;

  -- C4. Revertir usos de cupones de la corrida (vía coupon_usages,
  --     correcto para cupones multi-uso; decremento por cantidad).
  update public.coupons c
  set usos_actuales = greatest(c.usos_actuales - t.cnt, 0), order_id = null
  from (
    select cu.coupon_id, count(*) as cnt
    from public.coupon_usages cu
    join _target_orders to_ on to_.id = cu.order_id
    group by cu.coupon_id
  ) t
  where c.id = t.coupon_id;

  delete from public.coupon_usages cu
  using _target_orders to_
  where cu.order_id = to_.id;

  -- C5. Marcar órdenes como cancelled
  update public.orders o
  set status = 'cancelled'
  from _target_orders to_
  where o.id = to_.id;
  get diagnostics v_count = row_count;

  -- C6. Marcar payments como failed
  update public.payments p
  set status = 'failed'
  from _target_orders to_
  where p.order_id = to_.id
    and p.status = 'pending';

  -- C7. Auditar (razón según rama: whatsapp vs standard)
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  select 'orders', o.id::text, 'status_change',
         jsonb_build_object('status', 'cancelled', 'reason',
           case when exists (select 1 from public.tickets t where t.order_id = o.id)
                then 'whatsapp_abandoned_72h'
                else 'stale_pending_expired' end),
         'system'
  from _target_orders to_
  join public.orders o on o.id = to_.id;

  return jsonb_build_object('ok', true, 'expired_count', v_count,
    'tickets_expired', v_tickets_expired,
    'cutoff_standard', v_cutoff_standard, 'cutoff_whatsapp', v_cutoff_whatsapp);
end;
$func$;

-- Permisos de la RPC (patrón de hardening PERM-001 de neon_schema:
-- revoke de PUBLIC + grant a app_user). El cron conecta como owner
-- (o miembro de app_user) → sigue teniendo EXECUTE.
revoke execute on function public.expire_stale_orders_v2(integer, integer, boolean) from public;
grant execute on function public.expire_stale_orders_v2(integer, integer, boolean) to app_user;

-- [FIX 5R] Documentar la firma: p_max_hours_whatsapp es VESTIGIAL por
-- compatibilidad con /api/cron/expire-orders (llama expire_stale_orders_v2(60,72));
-- la fuente de verdad de la rama whatsapp es tickets.fecha_expiracion (72h).
comment on function public.expire_stale_orders_v2(integer, integer, boolean) is
  'Cron único de expiración (F3.4). p_minutes_standard: ventana de órdenes sin ticket. '
  'p_max_hours_whatsapp: vestigial por compatibilidad de firma con el cron existente — '
  'la rama whatsapp usa tickets.fecha_expiracion (alineada a 72h) como fuente de verdad. '
  'p_process_whatsapp=false: desactiva la rama whatsapp (toggle auto_expire_tickets_enabled).';

-- ═══════════════════════════════════════════════════════════════
-- REPORTES DE VERIFICACIÓN (para el SQL Editor de Neon)
-- ═══════════════════════════════════════════════════════════════
select 'settings' as objeto, count(*) as filas from public.settings
union all
select 'tickets_totales', count(*) from public.tickets;

-- Tickets legacy 'new' que recibirán fecha_expiracion (backfill ya aplicado)
select count(*) as tickets_legacy_new
from public.tickets where status = 'new';

-- Verificación de la firma nueva (debe existir SOLO la de 3 parámetros)
select p.proname, pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public' and p.proname = 'expire_stale_orders_v2';

commit;

-- ═══════════════════════════════════════════════════════════════
-- NOTA ROLLBACK (si algo sale mal en Neon):
--   1. Tickets de pedido marcados 'expirado' por el cron: la RPC marca tanto
--      'pendiente' (nuevo flujo) como 'new' (legacy checkout), así que un
--      UPDATE genérico a 'pendiente' desetiquetaría mal los legacy. Para
--      precisión restaurar desde backup; aproximación si no hay backup:
--        UPDATE tickets SET status='pendiente' WHERE status='expirado';
--   2. DROP FUNCTION public.expire_stale_orders_v2(integer, integer, boolean);
--   3. Re-crear la firma vieja desde 00022 (sin p_process_whatsapp).
--   4. DELETE FROM settings; DROP TABLE settings;
--   5. ALTER TABLE tickets DROP COLUMN ... (5 columnas nuevas);
--      DROP SEQUENCE ticket_numero_seq; DROP INDEX tickets_numero_active_idx;
--      Re-crear CHECK tickets_status_check con los 4 estados de 00010.
-- ═══════════════════════════════════════════════════════════════
