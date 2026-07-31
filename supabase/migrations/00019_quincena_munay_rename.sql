-- =============================================================
-- Migración 00019 — Renombrar "Compra de la semana" → "Quincena Munay"
--
-- Contexto:
--   La migración 00018 ya fue ejecutada y renombró los títulos de
--   week_buy_campaigns de "Week Buy:" a "Compra de la semana:".
--   El naming definitivo de marca es "Quincena Munay", así que esta
--   migración corrige los datos YA aplicados (00018 no se edita).
--
--   Cubre AMBOS prefijos legacy por seguridad:
--     'Week Buy:'            (seed original, si 00018 no llegó a correr)
--     'Compra de la semana:' (resultado de 00018 ya ejecutada)
--
-- Idempotente / seguro de re-ejecutar:
--   El UPDATE solo afecta filas cuyo title coincide con
--   '^(Week Buy|Compra de la semana):' (case-insensitive, anclado).
--   Una segunda ejecución no encuentra filas y no cambia nada.
--
-- Compatible con Neon (Postgres 16). Sin cambios de esquema.
-- =============================================================

begin;

-- Verificación previa (cuántas filas tienen prefijos legacy)
select count(*) as titulos_legacy_previos
from public.week_buy_campaigns
where title ~* '^(Week Buy|Compra de la semana):';

-- Paso 1: Renombrar títulos y descripciones al naming definitivo
update public.week_buy_campaigns
set
  title = regexp_replace(title, '^(Week Buy|Compra de la semana):', 'Quincena Munay:', 'i'),
  description = regexp_replace(description, '(Week Buy|Compra de la semana)', 'Quincena Munay', 'gi')
where title ~* '^(Week Buy|Compra de la semana):';

-- Paso 2: Refrescar comentarios de tabla y vista con el naming actual
comment on table public.week_buy_campaigns is
  'Campañas Quincena Munay — oferta quincenal por categoría con descuento progresivo';

comment on view public.active_week_buy is
  'Campaña Quincena Munay activa con tiempo restante y progreso de compromisos';

-- Verificación final (debe retornar 0 — sin prefijos legacy)
select count(*) as titulos_legacy_restantes
from public.week_buy_campaigns
where title ~* '^(Week Buy|Compra de la semana):';

commit;
