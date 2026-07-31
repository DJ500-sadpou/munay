-- =============================================================
-- Migración 00021 — expire_stale_orders_v3 (reversión de cupones)
--
-- Contexto (F1 del plan CUPONES vs CÓDIGO FLASH):
--   [FIX #7] Si una orden expira/cancela, el cupón de descuento que
--   la consumió (coupons.order_id) debe devolver su uso: usos_actuales-1
--   y order_id=NULL. La RPC v2 (migración 00012, ya aplicada) NO lo hace.
--
--   Como las migraciones aplicadas no se editan, esta 00021 crea la
--   RPC v3 (CREATE OR REPLACE) que añade ese paso antes de marcar
--   las órdenes como cancelled.
--
-- Compatible con Neon (Postgres 16). Idempotente (CREATE OR REPLACE).
-- =============================================================

-- La RPC v2 se reemplaza por v3 con reversión de cupones.
-- Se mantiene el mismo nombre para no tocar el CRON de Vercel.
CREATE OR REPLACE FUNCTION public.expire_stale_orders_v2(
  p_minutes_standard integer DEFAULT 60,
  p_max_hours_whatsapp integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
AS $func$
declare
  v_cutoff_standard timestamptz;
  v_cutoff_whatsapp timestamptz;
  v_count integer := 0;
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

  -- Liberar inventario de órdenes pendientes expiradas
  for v_item in
    select o.id as order_id, oi.product_id, oi.qty
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'pending'
      and (
        (o.created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
        OR
        (o.created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
      )
  loop
    perform public.release_inventory(v_item.product_id, v_item.qty);
  end loop;

  -- Devolver puntos redimidos antes de cancelar
  for v_order in
    select id, points_redeemed, customer_email
    from public.orders
    where status = 'pending'
      and (
        (created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
        OR
        (created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
      )
      and points_redeemed > 0
  loop
    select id into v_customer_id from public.customers where email = v_order.customer_email limit 1;
    if v_customer_id is not null then
      insert into public.point_transactions (customer_id, order_id, type, points, note)
      values (v_customer_id, v_order.id, 'adjust', v_order.points_redeemed, 'Devolución: orden expirada sin pago');
    end if;
  end loop;

  -- [FIX #7] Revertir el uso de cupones de descuento de las órdenes que
  -- están por expirar (aún pending) ANTES de marcarlas cancelled.
  -- [FIX Ronda 2] Reversión vía coupon_usages (correcta para cupones
  -- multi-uso: revierte TODOS los usos de cada orden que expira, no solo
  -- el último order_id).
  -- [FIX Ronda 3] Decremento por CANTIDAD de usos expirados por cupón
  -- (GROUP BY + count): si un cupón con usos_maximos > 1 fue usado por DOS
  -- órdenes que expiran en la misma corrida, se revierten -2, no -1.
  update public.coupons c
  set usos_actuales = greatest(c.usos_actuales - t.cnt, 0), order_id = null
  from (
    select cu.coupon_id, count(*) as cnt
    from public.coupon_usages cu
    join public.orders o on o.id = cu.order_id
    where o.status = 'pending'
      and (
        (o.created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
        OR
        (o.created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
      )
    group by cu.coupon_id
  ) t
  where c.id = t.coupon_id;

  delete from public.coupon_usages cu
  using public.orders o
  where cu.order_id = o.id
    and o.status = 'pending'
    and (
      (o.created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
      OR
      (o.created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = o.id))
    );

  -- Marcar órdenes como cancelled
  update public.orders set status = 'cancelled'
  where status = 'pending'
    and (
      (created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
      OR
      (created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
    );
  get diagnostics v_count = row_count;

  -- Marcar payments como failed
  update public.payments set status = 'failed'
  where order_id in (
    select id from public.orders where status = 'cancelled'
    and (
      (created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
      OR
      (created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
    )
  )
  and status = 'pending';

  -- Auditar
  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  select 'orders', id::text, 'status_change',
         jsonb_build_object('status', 'cancelled', 'reason',
           CASE WHEN EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id)
                THEN 'whatsapp_abandoned_72h'
                ELSE 'stale_pending_expired' END),
         'system'
  from public.orders
  where status = 'cancelled'
    and (
      (created_at < v_cutoff_standard AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
      OR
      (created_at < v_cutoff_whatsapp AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id))
    );
  return jsonb_build_object('ok', true, 'expired_count', v_count,
    'cutoff_standard', v_cutoff_standard, 'cutoff_whatsapp', v_cutoff_whatsapp);
end;
$func$;
