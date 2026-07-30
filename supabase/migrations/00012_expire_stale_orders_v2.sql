-- Migración: RPC expire_stale_orders_v2 para CRON expire-orders
-- Ejecutado en Neon SQL Editor el 30/7/2026.
-- Reemplaza a expire_stale_pending_orders(30) con dos parámetros:
--   p_minutes_standard (60): órdenes normales sin ticket
--   p_max_hours_whatsapp (72): órdenes con ticket (WhatsApp)

-- Limpiar RPC antigua que ya no se usa
DROP FUNCTION IF EXISTS public.expire_stale_pending_orders(integer);

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