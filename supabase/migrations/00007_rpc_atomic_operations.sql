-- =============================================================
-- Migración 00007 — RPC atómicas para consumo de flash codes y stock.
--
-- Problema: si validamos y actualizamos uses_count en pasos separados
-- (SELECT → UPDATE), dos compras concurrentes pueden pasar el check
-- y exceder max_uses. Solución: RPC atómica con row-level lock.
--
-- También: función para decrementar stock de forma segura.
-- =============================================================

-- -------------------------------------------------------------
-- consume_flash_code(p_code, p_max_uses_to_consume)
-- -------------------------------------------------------------
-- Intenta consumir 1 uso de un código flash de forma atómica.
-- Retorna:
--   { ok: true, code, type, discount_percent, discount_cents }
--   { ok: false, reason: 'not_found' | 'inactive' | 'expired' | 'exhausted' }
--
-- Usa SELECT ... FOR UPDATE para bloquear la fila durante la transacción.
-- -------------------------------------------------------------
create or replace function public.consume_flash_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.flash_codes%rowtype;
  v_result jsonb;
begin
  -- Lock explícito sobre la fila del código
  select * into v_row
  from public.flash_codes
  where code = upper(p_code)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not v_row.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  if now() < v_row.starts_at then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;

  if now() > v_row.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_row.max_uses is not null and v_row.uses_count >= v_row.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;

  -- Incrementar uses_count
  update public.flash_codes
  set uses_count = uses_count + 1
  where code = v_row.code;

  return jsonb_build_object(
    'ok', true,
    'code', v_row.code,
    'type', v_row.type,
    'discount_percent', v_row.discount_percent,
    'discount_cents', v_row.discount_cents
  );
end;
$$;

comment on function public.consume_flash_code is
'Consume 1 uso de un código flash de forma atómica (SELECT FOR UPDATE + UPDATE en la misma transacción).';

-- -------------------------------------------------------------
-- reserve_inventory(p_product_id, p_qty)
-- -------------------------------------------------------------
-- Reserva p_qty unidades de un producto (incrementa `reserved`).
-- No permite reserved > stock.
-- Retorna: { ok: true, stock, reserved } | { ok: false, reason }
-- -------------------------------------------------------------
create or replace function public.reserve_inventory(
  p_product_id uuid,
  p_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory%rowtype;
begin
  if p_qty <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_qty');
  end if;

  select * into v_row
  from public.inventory
  where product_id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_inventory');
  end if;

  if v_row.stock - v_row.reserved < p_qty then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'available', v_row.stock - v_row.reserved);
  end if;

  update public.inventory
  set reserved = reserved + p_qty
  where product_id = p_product_id;

  return jsonb_build_object(
    'ok', true,
    'stock', v_row.stock,
    'reserved', v_row.reserved + p_qty
  );
end;
$$;

comment on function public.reserve_inventory is
'Reserva qty unidades de un producto (incrementa reserved). Atómico con FOR UPDATE.';

-- -------------------------------------------------------------
-- commit_inventory(p_product_id, p_qty)
-- -------------------------------------------------------------
-- Concreta la venta: decrementa stock y reserved en p_qty.
-- Se llama al confirmar el pago.
-- -------------------------------------------------------------
create or replace function public.commit_inventory(
  p_product_id uuid,
  p_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory%rowtype;
begin
  if p_qty <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_qty');
  end if;

  select * into v_row
  from public.inventory
  where product_id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_inventory');
  end if;

  if v_row.reserved < p_qty then
    -- No hay suficiente reservado: igual decrementamos stock
    -- (puede pasar si la reserva expiró o se omitió).
    update public.inventory
    set stock = greatest(0, stock - p_qty),
        reserved = greatest(0, reserved - p_qty)
    where product_id = p_product_id;
  else
    update public.inventory
    set stock = greatest(0, stock - p_qty),
        reserved = greatest(0, reserved - p_qty)
    where product_id = p_product_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.commit_inventory is
'Concreta venta: decrementa stock y reserved. Llamar al confirmar pago.';

-- -------------------------------------------------------------
-- release_inventory(p_product_id, p_qty)
-- -------------------------------------------------------------
-- Libera una reserva (decrementa reserved sin tocar stock).
-- Se llama si el pago falla/cancela.
-- -------------------------------------------------------------
create or replace function public.release_inventory(
  p_product_id uuid,
  p_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_qty');
  end if;

  update public.inventory
  set reserved = greatest(0, reserved - p_qty)
  where product_id = p_product_id;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.release_inventory is
'Libera reserva (decrementa reserved, no toca stock). Llamar si el pago falla.';

-- -------------------------------------------------------------
-- award_points(p_order_id)
-- -------------------------------------------------------------
-- Acredita puntos al customer de una orden paid.
--   1. Busca o crea el customer por email.
--   2. Calcula puntos = floor(total_cents / 100).
--   3. Inserta point_transaction type=earn.
--   4. Retorna { ok, customer_id, points_awarded }.
-- Idempotente: si ya existe tx con ese order_id, no duplica.
-- -------------------------------------------------------------
create or replace function public.award_points(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_points integer;
  v_existing_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if v_order.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_paid');
  end if;

  -- Idempotencia: no acreditar 2 veces
  select count(*) into v_existing_count
  from public.point_transactions
  where order_id = p_order_id and type = 'earn';

  if v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_awarded');
  end if;

  -- Buscar o crear customer
  select id into v_customer_id
  from public.customers
  where email = v_order.customer_email
  limit 1;

  if v_customer_id is null then
    insert into public.customers (email)
    values (v_order.customer_email)
    returning id into v_customer_id;
  end if;

  -- Calcular puntos (1 punto por $1)
  v_points := floor(v_order.total_cents / 100);

  if v_points > 0 then
    insert into public.point_transactions (customer_id, order_id, type, points, note)
    values (v_customer_id, p_order_id, 'earn', v_points, 'Puntos por compra');
  end if;

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer_id,
    'points_awarded', v_points
  );
end;
$$;

comment on function public.award_points is
'Acredita puntos a un customer tras orden paid. Idempotente (no duplica si ya se acreditó).';
