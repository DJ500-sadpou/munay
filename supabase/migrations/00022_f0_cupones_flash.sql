-- =============================================================
-- Migración 00022 — F0: Separación CUPONES vs CÓDIGO FLASH
--
-- ⚠️ ORDEN OBLIGATORIO DE DESPLIEGUE (FIX #19):
--    Ejecutar este archivo SOLO después de desplegar en Vercel el
--    código actual (F1/F3): el DROP de consume_flash_code y el INSERT
--    que lee discount_percent asumen que el checkout ya NO usa la RPC
--    ni el código flash como descuento. Si producción corre código
--    anterior, la migración rompería el checkout.
--
-- Contexto (plan PLAN_SEPARACION_CUPONES_FLASH.md, F0):
--   Dos sistemas de negocio que quedaron mezclados en flash_codes:
--     • CUPONES      → descuento % general (checkout) → tabla `coupons`
--     • CÓDIGO FLASH → descubrimiento (búsqueda) → flash_codes SOLO 'unlock'
--
-- Estructura del archivo (IMPORTANTE):
--   ▶ BLOQUE A — "Ejecutar AHORA" (seguro con el código desplegado):
--       1. Rol app_user (idempotente)
--       2. Tabla coupons + índice lower(codigo)        (IF NOT EXISTS — 00020)
--       3. Tabla coupon_usages + índice                (IF NOT EXISTS — 00020)
--       4. GRANTs a app_user
--       5. Backups para rollback
--       6. Migración de datos: flash_codes 'discount' → coupons
--       7. flash_code_products: columna precio_especial_cents
--       8. Backfill precio_especial_cents (no-op en la práctica)
--       9. RPC expire_stale_orders_v2 (reversión de cupones — 00021)
--      10. DROP RPC consume_flash_code (0 llamadores en src — verificado)
--      11. Reportes (migrados / huérfanos)
--
--   ▶ BLOQUE B — "Ejecutar DESPUÉS del deploy del código unlock-only":
--       Refactor destructivo de flash_codes: drop columnas discount_* y
--       refactor del enum flash_code_type a ('unlock').
--       NO pegar este bloque todavía: el código desplegado aún lee
--       discount_percent/discount_cents en admin, API, catálogo y
--       products-neon.ts. Solo es seguro tras actualizar ese código.
--
-- Compatible con Neon (Postgres 16). Idempotente. Transaccional.
-- =============================================================

begin;

-- ═══════════════════════════════════════════════════════════════
-- BLOQUE A — Ejecutar AHORA
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Rol app_user (idempotente — mismo patrón que neon_roles_patch) ──
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;

-- ── 2. Tabla `coupons` (00020, idempotente) ──
create table if not exists public.coupons (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique check (char_length(codigo) between 4 and 32),
  tipo                  text not null check (tipo in ('general', 'primera_compra')),
  porcentaje_descuento  integer not null check (porcentaje_descuento between 0 and 100),
  monto_minimo_compra   integer not null default 2000 check (monto_minimo_compra >= 0),
  fecha_inicio          timestamptz not null default now(),
  fecha_fin             timestamptz not null,
  activo                boolean not null default true,
  usos_maximos          integer check (usos_maximos is null or usos_maximos > 0),
  usos_actuales         integer not null default 0 check (usos_actuales >= 0),
  order_id              uuid,
  created_at            timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);

create unique index if not exists coupons_codigo_lower_idx
  on public.coupons (lower(codigo));

-- ── 3. Tabla `coupon_usages` (00020, idempotente) ──
create table if not exists public.coupon_usages (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  order_id   uuid not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists coupon_usages_order_idx
  on public.coupon_usages (order_id);

-- ── 4. Permisos (rol app_user) ──
grant select, insert, update, delete on public.coupons to app_user;
grant select, insert, delete on public.coupon_usages to app_user;

-- ── 5. Backups para rollback (FIX #4/#20) ──
--   coupons_backup: filas discount de flash_codes ANTES de migrar/borrar.
--   flash_code_products_backup: puente completa antes de limpiar.
create table if not exists public.coupons_backup as
  select * from public.flash_codes where type = 'discount';

create table if not exists public.flash_code_products_backup as
  select * from public.flash_code_products;

-- ── 6. Migración de datos: flash_codes 'discount' → coupons ──
--   [FIX #1] COALESCE para NULLs (fecha_fin → +30 días, % → 15).
--   [FIX #21] Códigos normalizados (btrim/upper).
--   [FIX Ronda 1 ALTA] El guard del WHERE compara los valores COALESCIDOS
--     (los que realmente se insertan), no los crudos: evita violar el
--     CHECK (fecha_fin > fecha_inicio) y abortar toda la transacción
--     cuando un código vencido tiene starts_at NULL o ends_at NULL con
--     starts_at a +30 días.
--   [FIX Ronda 1 MEDIA] ON CONFLICT DO NOTHING sin target: captura
--     también colisiones en el índice lower(codigo) (cupón pre-existente
--     en otro casing), no solo el constraint exacto.
--   [FIX Ronda 1 MEDIA] Guard de longitud 4-32 (dato corrupto no aborta).
insert into public.coupons (
  codigo, tipo, porcentaje_descuento, monto_minimo_compra,
  fecha_inicio, fecha_fin, activo, usos_maximos, usos_actuales
)
select
  btrim(upper(code)),
  'general',
  coalesce(discount_percent, 15),
  2000,                                              -- monto mínimo default ($20)
  coalesce(starts_at, now()),
  coalesce(ends_at, now() + interval '30 days'),
  active,
  max_uses,
  uses_count
from public.flash_codes
where type = 'discount'
  and char_length(btrim(upper(code))) between 4 and 32
  and coalesce(max_uses, 1) > 0
  and coalesce(ends_at, now() + interval '30 days') > coalesce(starts_at, now())
on conflict do nothing;                               -- [FIX #4] + Ronda 1

-- ── 7. flash_code_products: precio especial por producto ──
--   [FIX #6] NULL → usar price_cents del producto.
alter table public.flash_code_products
  add column if not exists precio_especial_cents integer;

comment on column public.flash_code_products.precio_especial_cents is
  'Precio especial por producto para códigos unlock. NULL → usar price_cents (FIX #6).';

-- ── 8. Backfill precio_especial_cents desde discount_percent ──
--   [FIX #8] En la práctica es no-op: los códigos unlock tienen
--   discount_percent NULL y las filas discount se eliminan en BLOQUE B.
--   Ojo: también toca filas puente de códigos discount (que se limpian
--   recién en BLOQUE B) — inofensivo, documentado para que el BLOQUE B
--   no parezca redundante.
--
--   [FIX Ronda 3 — ERROR 42P01] PostgreSQL NO permite referenciar la
--   tabla objetivo del UPDATE (fcp) dentro de un JOIN en la cláusula
--   FROM ("invalid reference to FROM-clause entry"). Se reescribe con
--   FROM de entradas separadas por comas + filtros en el WHERE, que es
--   semánticamente idéntico y compatible con Postgres 16.
update public.flash_code_products fcp
set precio_especial_cents = round(p.price_cents * (1 - fc.discount_percent::numeric / 100))
from public.flash_codes fc, public.products p
where fcp.code = fc.code
  and p.id = fcp.product_id
  and fc.discount_percent is not null
  and fcp.precio_especial_cents is null;

-- ── 9. RPC expire_stale_orders_v2 (00021) — reversión de cupones ──
--   CREATE OR REPLACE (idempotente). Reemplaza la v2 de 00012 por la
--   v3 que revierte usos_actuales de coupons vía coupon_usages cuando
--   la orden expira o se cancela (FIX #7 + FIX Ronda 2/3).
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

  -- [FIX #7] Revertir usos de cupones de órdenes por expirar (vía coupon_usages,
  -- correcto para cupones multi-uso; decremento por cantidad con GROUP BY + count).
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

-- ── 10. DROP RPC consume_flash_code ──
--   Verificado: 0 llamadores en src/ (solo definiciones en stubs
--   deprecated lib/supabase/{admin,server}.ts que no se ejecutan).
drop function if exists public.consume_flash_code(text);

-- ── 11. Reportes ──
--   [FIX Ronda 1 LOW] El conteo anterior ('cupones_migrados') era
--   engañoso: contaba TODOS los coupons (incl. pre-existentes de 00020).
--   Ahora se reporta el delta real: códigos discount fuente vs total.
select count(*) as codigos_discount_fuente
from public.flash_codes where type = 'discount';

select count(*) as cupones_totales from public.coupons;
select count(*) as codigos_flash_restantes from public.flash_codes;
-- [FIX #18] Códigos unlock sin productos asociados (huérfanos)
select fc.code
from public.flash_codes fc
where not exists (select 1 from public.flash_code_products fcp where fcp.code = fc.code);

commit;

-- ═══════════════════════════════════════════════════════════════
-- BLOQUE B — NO ejecutar todavía
-- Ejecutar SOLO después de desplegar el código que deja de leer
-- discount_percent/discount_cents (admin flash-codes, api/flash-codes/*,
-- catalogo, p/[slug], flash/[code], products-neon.ts).
--
-- NOTA ROLLBACK (FIX Ronda 1 MEDIA): coupons_backup conserva filas con
-- type='discount', pero tras este bloque el enum queda ('unlock'). Para
-- revertir: (1) recrear el valor 'discount' del enum y las columnas
-- discount_*, (2) INSERT INTO flash_codes SELECT * FROM coupons_backup.
--
-- begin;
--
-- -- Guarda: no debe quedar ningún código 'discount'
-- do $$
-- declare v_left integer;
-- begin
--   select count(*) into v_left from public.flash_codes where type = 'discount';
--   if v_left > 0 then
--     raise exception 'Aún existen % códigos discount. Migra los descuentos a coupons antes de refactorizar.', v_left;
--   end if;
-- end $$;
--
-- -- Eliminar puentes huérfanos de códigos discount (por si quedaran)
-- delete from public.flash_code_products
-- where code in (select code from public.flash_codes where type = 'discount');
--
-- -- Refactor del enum: solo 'unlock'
-- create type flash_code_type_new as enum ('unlock');
-- -- [FIX Ronda 4 ALTA 42883] El CHECK flash_codes_check1 compara
-- -- type = 'discount'::flash_code_type (enum viejo) contra el nuevo tipo.
-- -- PG intenta revalidarlo al ALTER TYPE y lanza 'operator does not exist:
-- -- flash_code_type_new = flash_code_type'. Se dropea ANTES y se re-crea
-- -- simplificado DESPUÉS (solo 'unlock'), sin referencia a discount_*.
-- alter table public.flash_codes drop constraint if exists flash_codes_check1;
-- alter table public.flash_codes
--   alter column type type flash_code_type_new
--   using (type::text::flash_code_type_new);
-- -- [FIX Ronda 3 ALTA] coupons_backup (CTAS del BLOQUE A) hereda el enum en su
-- -- columna type. Sin esto, 'drop type' falla por dependencia (cannot drop type
-- -- ... because other objects depend on it) y hace ROLLBACK completo.
-- alter table public.coupons_backup alter column type type text using (type::text);
-- drop type flash_code_type;
-- alter type flash_code_type_new rename to flash_code_type;
-- -- Re-crear el CHECK simplificado para el esquema unlock-only
-- alter table public.flash_codes
--   add constraint flash_codes_check1 check (type = 'unlock'::flash_code_type);
--
-- -- Drop de columnas discount (el código ya no las lee)
-- alter table public.flash_codes drop column if exists discount_percent;
-- alter table public.flash_codes drop column if exists discount_cents;
--
-- commit;
-- ═══════════════════════════════════════════════════════════════
