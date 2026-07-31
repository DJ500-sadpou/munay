-- =============================================================
-- Migración 00020 — Tabla `coupons` (sistema de cupones)
--
-- [FIX Ronda 2] Antes del GRANT a app_user, garantizar que el rol exista
-- (idempotente — mismo patrón que neon_roles_patch.sql). En una Neon
-- fresh donde el parche aún no corrió, el GRANT fallaría sin este bloque.
--
-- Contexto (F1 del plan de separación CUPONES vs CÓDIGO FLASH):
--   Los cupones de descuento generales viven en su PROPIA tabla,
--   completamente independiente de:
--     - flash_codes (mecanismo de descubrimiento → búsqueda)
--     - loyalty_coupons (fidelidad por usuario, prefijo FID-)
--
-- Columnas clave:
--   - codigo: texto único, case-insensitive (índice lower)
--   - tipo: general | primera_compra
--   - porcentaje_descuento: % sobre el subtotal del checkout
--   - monto_minimo_compra: subtotal mínimo (centavos, default $20)
--   - usos_maximos/usos_actuales: control de consumo
--   - order_id: [FIX #7] referencia a la orden que consumió el cupón
--     (permite revertir usos_actuales si la orden expira/cancela)
--
-- Compatible con Neon (Postgres 16). Idempotente.
-- =============================================================

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

-- [FIX #21] Índice case-insensitive: MUNAY25 y munay25 son el mismo cupón.
create unique index if not exists coupons_codigo_lower_idx
  on public.coupons (lower(codigo));

comment on table public.coupons is
  'Cupones de descuento generales (general | primera_compra). Independiente de flash_codes y loyalty_coupons.';

comment on column public.coupons.order_id is
  'Orden que consumió el cupón — permite revertir usos_actuales si la orden expira o se cancela (FIX #7).';

-- [FIX Ronda 2] Crear rol app_user si no existe (idempotente) — sin esto,
-- el GRANT de abajo fallaría en una Neon fresh donde neon_roles_patch.sql
-- aún no se aplicó.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- Permisos — patrón del proyecto (rol app_user, ver neon_roles_patch.sql).
-- La app se conecta con un rol miembro de app_user; sin estos GRANTs,
-- las queries a coupons fallarían con permission denied.
grant select, insert, update, delete on public.coupons to app_user;

-- =============================================================
-- [FIX Ronda 2] Tabla `coupon_usages` — registro de consumos por orden.
--
-- Problema que resuelve: la columna `coupons.order_id` es de valor único;
-- con cupones de `usos_maximos > 1` cada consumo sobrescribe el order_id
-- anterior, por lo que la reversión `WHERE order_id = X` solo funcionaba
-- para cupones de un solo uso.
--
-- Con coupon_usages, cada (coupon_id, order_id) queda registrado y la
-- reversión (markOrderCancelled / CRON 00021) revierte TODOS los usos
-- de la orden que expira/cancela.
-- =============================================================

create table if not exists public.coupon_usages (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  order_id   uuid not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists coupon_usages_order_idx
  on public.coupon_usages (order_id);

comment on table public.coupon_usages is
  'Consumos de cupones por orden — permite revertir usos_actuales correctamente en cupones multi-uso (FIX Ronda 2).';

grant select, insert, delete on public.coupon_usages to app_user;
