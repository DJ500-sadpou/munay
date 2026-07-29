-- =============================================================
-- Migración 00008 — Endurecimiento de producción.
--
-- 1. Índices adicionales para queries frecuentes.
-- 2. Tabla `audit_log` para registrar cambios sensibles.
-- 3. Trigger que registra cambios de estado en `orders`.
-- 4. Función `expire_stale_pending_orders` para limpiar órdenes
--    pendientes sin pago por más de X minutos (llamar vía cron).
-- 5. Función `refund_order` que revierte stock + puntos de una
--    orden pagada (para uso admin).
-- =============================================================

-- -------------------------------------------------------------
-- 1. Índices adicionales
-- -------------------------------------------------------------
create index if not exists idx_products_active_created
  on public.products (active, created_at desc);

create index if not exists idx_orders_status_created
  on public.orders (status, created_at desc);

create index if not exists idx_orders_paid_revenue
  on public.orders (total_cents) where status = 'paid';

create index if not exists idx_order_items_product_paid
  on public.order_items (product_id)
  where exists (select 1 from orders where orders.id = order_items.order_id and orders.status = 'paid');

create index if not exists idx_point_transactions_customer_type
  on public.point_transactions (customer_id, type, created_at desc);

create index if not exists idx_flash_codes_active_window
  on public.flash_codes (active, starts_at, ends_at);

-- -------------------------------------------------------------
-- 2. Tabla audit_log
-- -------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('insert', 'update', 'delete', 'status_change')),
  old_data    jsonb,
  new_data    jsonb,
  actor       text,  -- 'admin:email' | 'system' | 'webhook' | 'user:uuid'
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_table_row
  on public.audit_log (table_name, row_id, created_at desc);

create index if not exists idx_audit_log_created
  on public.audit_log (created_at desc);

comment on table public.audit_log is 'Registro de cambios sensibles (status de órdenes, reembolsos, ajustes de puntos).';

-- RLS: solo admins pueden leer audit_log; nadie escribe directo (solo triggers/functions con security definer).
alter table public.audit_log enable row level security;

drop policy if exists "audit_log: admin read" on public.audit_log;
create policy "audit_log: admin read"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------
-- 3. Trigger: registrar cambios de status en orders
-- -------------------------------------------------------------
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo log si cambió el status
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) or tg_op = 'INSERT' then
    insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
    values (
      'orders',
      new.id::text,
      case when tg_op = 'INSERT' then 'insert' else 'status_change' end,
      case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
      to_jsonb(new),
      case
        when current_setting('app.actor', true) is not null then current_setting('app.actor', true)
        else 'system'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_audit on public.orders;
create trigger trg_orders_audit
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();

comment on function public.log_order_status_change is 'Trigger que audita cambios de status en orders.';

-- -------------------------------------------------------------
-- 4. expire_stale_pending_orders(p_minutes)
-- -------------------------------------------------------------
-- Marca como 'cancelled' las órdenes pendientes sin pago confirmado
-- después de p_minutes (default 30). Libera el inventario reservado.
-- Llamar desde un cron job (Supabase pg_cron o Vercel Cron).
-- -------------------------------------------------------------
create or replace function public.expire_stale_pending_orders(p_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - (p_minutes || ' minutes')::interval;
  v_count integer := 0;
  v_item record;
begin
  -- Buscar órdenes pendientes viejas
  for v_item in
    select o.id as order_id, oi.product_id, oi.qty
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'pending' and o.created_at < v_cutoff
  loop
    -- Liberar inventario
    perform public.release_inventory(v_item.product_id, v_item.qty);
  end loop;

  -- Marcar órdenes como cancelled
  update public.orders
  set status = 'cancelled'
  where status = 'pending' and created_at < v_cutoff;

  get diagnostics v_count = row_count;

  -- Marcar payments como failed
  update public.payments
  set status = 'failed'
  where order_id in (
    select id from public.orders where status = 'cancelled' and created_at < v_cutoff
  )
  and status = 'pending';

  -- Auditar
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  select 'orders', id::text, 'status_change',
         jsonb_build_object('status', 'cancelled', 'reason', 'stale_pending_expired'),
         'system'
  from public.orders
  where status = 'cancelled' and created_at < v_cutoff;

  return jsonb_build_object('ok', true, 'expired_count', v_count, 'cutoff', v_cutoff);
end;
$$;

comment on function public.expire_stale_pending_orders is 'Cancela órdenes pendientes sin pago por más de p_minutes. Llamar vía cron.';

-- -------------------------------------------------------------
-- 5. refund_order(p_order_id, p_reason)
-- -------------------------------------------------------------
-- Reembolsa una orden pagada:
--   - Marca status = 'refunded'.
--   - Revierte la acreditación de puntos (insert tx type=adjust negativo).
--   - Si se redimieron puntos, los devuelve (insert tx type=adjust positivo).
--   - No revierte el decremento de stock (la pieza ya se envió o no se puede recuperar).
--   - Audita la acción.
-- Solo ejecutable por service role o admin (vía Edge Function).
-- -------------------------------------------------------------
create or replace function public.refund_order(p_order_id uuid, p_reason text default 'Reembolso solicitado')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_earn_points integer := 0;
  v_redeem_points integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if v_order.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_paid', 'current_status', v_order.status);
  end if;

  -- Marcar como refunded
  update public.orders set status = 'refunded' where id = p_order_id;

  -- Buscar customer
  select id into v_customer_id
  from public.customers
  where email = v_order.customer_email
  limit 1;

  if v_customer_id is not null then
    -- Revertir puntos ganados (tx negativa)
    select coalesce(sum(points), 0) into v_earn_points
    from public.point_transactions
    where order_id = p_order_id and type = 'earn';

    if v_earn_points > 0 then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, p_order_id, 'adjust', -v_earn_points, 'Reembolso: reversión de puntos ganados');
    end if;

    -- Devolver puntos redimidos (tx positiva)
    v_redeem_points := v_order.points_redeemed;
    if v_redeem_points > 0 then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, p_order_id, 'adjust', v_redeem_points, 'Reembolso: devolución de puntos redimidos');
    end if;
  end if;

  -- Marcar payment como refunded
  update public.payments
  set status = 'refunded'
  where order_id = p_order_id and status = 'captured';

  -- Auditar
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  values (
    'orders',
    p_order_id::text,
    'status_change',
    jsonb_build_object('status', 'refunded', 'reason', p_reason, 'earn_reverted', v_earn_points, 'redeem_returned', v_redeem_points),
    case when current_setting('app.actor', true) is not null then current_setting('app.actor', true) else 'admin' end
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'earn_points_reverted', v_earn_points,
    'redeem_points_returned', v_redeem_points
  );
end;
$$;

comment on function public.refund_order is 'Reembolsa una orden pagada: revierte puntos ganados, devuelve puntos redimidos, marca status=refunded. No toca stock.';

-- -------------------------------------------------------------
-- 6. Función helper para establecer el actor en transacciones
-- -------------------------------------------------------------
-- Uso: select set_config('app.actor', 'admin:juan@example.com', true);
-- antes de llamar a refund_order u otras funciones auditadas.
-- Esto permite que el trigger registre quién hizo el cambio.
create or replace function public.set_audit_actor(p_actor text)
returns void
language sql
security definer
as $$
  select set_config('app.actor', p_actor, true);
$$;

comment on function public.set_audit_actor is 'Establece el actor para auditoría (usar antes de llamar funciones sensibles).';
