-- =============================================================
-- Parche SQL — Arreglar permisos de RPCs en Neon.
--
-- Aplicar ESTE archivo DESPUÉS de neon_schema.sql en el SQL Editor de Neon.
--
-- Problema que resuelve:
--   El esquema principal hace `GRANT EXECUTE ... TO authenticated`
--   pero el rol `authenticated` NO existe en Neon (es interno de Supabase).
--   Al ejecutar neon_schema.sql con ON_ERROR_STOP, aborta en la línea del
--   primer GRANT. Sin ON_ERROR_STOP, los grants fallan y las RPCs solo son
--   ejecutables por el owner.
--
-- Solución:
--   1. Crear rol `app_user` (sin login) si no existe.
--   2. Otorgar EXECUTE sobre las RPCs críticas a `app_user`.
--   3. Hacer al rol de conexión (default: `neondb_owner`) miembro de `app_user`.
--   4. Mantener REVOKE de PUBLIC para que nadie más pueda ejecutarlas.
--
-- Tras aplicar este parche, las RPCs son ejecutables SOLO por:
--   - El owner del schema (por defecto en Neon).
--   - Cualquier rol miembro de `app_user`.
--   - NO por anon ni por roles sin grant.
-- =============================================================

-- 1. Crear rol app_user si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- 2. Otorgar USAGE sobre el schema
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. GRANTs de EXECUTE sobre las 8 RPCs críticas
GRANT EXECUTE ON FUNCTION public.consume_flash_code(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(uuid, integer) TO app_user;
GRANT EXECUTE ON FUNCTION public.commit_inventory(uuid, integer) TO app_user;
GRANT EXECUTE ON FUNCTION public.release_inventory(uuid, integer) TO app_user;
GRANT EXECUTE ON FUNCTION public.award_points(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.redeem_points(text, integer, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_orders(integer) TO app_user;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid, text) TO app_user;

-- 4. Hacer al rol owner miembro de app_user (idempotente).
-- En Neon, el rol de conexión default es `neondb_owner`.
-- Si tu connection string usa un rol distinto (ej: `munay_owner`),
-- ajusta el nombre abajo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = 'app_user')
      AND member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    -- Solo el superuser puede hacer GRANT de role membership.
    -- Si falla, ejecuta manualmente como superuser:
    --   GRANT app_user TO neondb_owner;
    -- o al rol que use tu connection string.
    BEGIN
      EXECUTE format('GRANT app_user TO %I', current_user);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No se pudo hacer GRANT app_user TO %. Ejecuta manualmente: GRANT app_user TO <tu_rol>;', current_user;
    END;
  END IF;
END $$;

-- 5. Verificación: debe retornar 8 filas con has_privilege=true
SELECT
  p.proname AS function_name,
  has_function_privilege('app_user', p.oid, 'EXECUTE') AS app_user_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'consume_flash_code',
    'reserve_inventory',
    'commit_inventory',
    'release_inventory',
    'award_points',
    'redeem_points',
    'expire_stale_pending_orders',
    'refund_order'
  )
ORDER BY p.proname;
