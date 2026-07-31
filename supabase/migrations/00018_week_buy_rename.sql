-- =============================================================
-- Migración 00018 — Renombrar "Week Buy" → "Compra de la semana"
--
-- Contexto:
--   La UI migró al naming en español ("Compra de la semana",
--   ver localización en week-buy-banner.tsx y week-buy-list.tsx).
--   Esta migración actualiza los títulos existentes en
--   week_buy_campaigns que conservan el prefijo "Week Buy:"
--   y refresca los comentarios de tabla/vista en la DB.
--
-- Idempotente / seguro de re-ejecutar:
--   El UPDATE solo afecta filas cuyo title coincide con
--   '^Week Buy:' (case-insensitive, anclado al inicio).
--   Una segunda ejecución no encuentra filas y no cambia nada.
--
-- Compatible con Neon (Postgres 16). Sin cambios de esquema.
--
-- ⚠️ NOTA: el rename definitivo a "Quincena Munay" lo hace la
-- migración 00019. Esta 00018 quedó como quedó aplicada en Neon.
-- =============================================================

begin;

-- Verificación previa (cuántas filas se van a renombrar)
select count(*) as titulos_week_buy_previos
from public.week_buy_campaigns
where title ~* '^Week Buy:';

-- Paso 1: Renombrar títulos de campañas existentes
--   - title: regexp_replace anclado al inicio + case-insensitive
--   - description: mismo reemplazo por coherencia (si contiene el término)
update public.week_buy_campaigns
set
  title = regexp_replace(title, '^Week Buy:', 'Compra de la semana:', 'i'),
  description = replace(description, 'Week Buy', 'Compra de la semana')
where title ~* '^Week Buy:';

-- Paso 2: Refrescar comentarios de tabla y vista con el naming actual
comment on table public.week_buy_campaigns is
  'Campañas Compra de la semana — oferta semanal por categoría con descuento progresivo';

comment on view public.active_week_buy is
  'Campaña Compra de la semana activa con tiempo restante y progreso de compromisos';

-- Verificación final (debe retornar 0)
select count(*) as titulos_week_buy_restantes
from public.week_buy_campaigns
where title ~* '^Week Buy:';

commit;
