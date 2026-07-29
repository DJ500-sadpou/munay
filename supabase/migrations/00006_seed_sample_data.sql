-- =============================================================
-- Migración 00006 (SEED — solo para desarrollo local).
-- Datos de ejemplo para probar la integración en Fase 2.
-- ⚠️  NO aplicar en producción. Marcar como idempotente.
-- =============================================================

-- Productos --------------------------------------------------
insert into public.products (slug, title, description, price_cents, currency, condition, grading, active)
values
  (
    'amazonita-pulida',
    'Amazonita pulida — ejemplar de 320 g',
    'Ejemplar de amazonita natural pulida con tonos verde-azul característicos. Pieza única seleccionada a mano, ideal para colección o trabajo ceremonial. Peso: 320 g · Medida aprox: 7 × 5 × 3 cm.',
    1800, 'USD', 'used', 'excelente', true
  ),
  (
    'cuenco-ceremonial-ceramica-negra',
    'Cuenco ceremonial de cerámica negra',
    'Cuenco de cerámica negra de origen artesanal. Pieza usada con signos de uso anteriores que no afectan su función. Diámetro: 14 cm · Altura: 7 cm.',
    4500, 'USD', 'used', 'buena', true
  ),
  (
    'palo-santo-kg',
    'Palo santo — paquete de 1 kg (origen Ecuador)',
    'Leña de palo santo (Bursera graveolens) cosechada de forma sostenible en la costa ecuatoriana. Paquete de 1 kg aprox., trozos seleccionados para sahumerio.',
    2500, 'USD', 'new', null, true
  ),
  (
    'colgante-cuarzo-cristal',
    'Colgante de cuarzo cristal en hilo encerado',
    'Colgante de cuarzo cristal natural montado en hilo encerado ajustable. Pieza única.',
    1200, 'USD', 'new', null, true
  ),
  (
    'tapiz-tejido-a-mano-imbabura',
    'Tapiz tejido a mano — Imbabura (60×90 cm)',
    'Tapiz tejido a mano en lana por artesanos de Imbabura. Diseño tradicional con simbología andina.',
    6500, 'USD', 'used', 'excelente', true
  ),
  (
    'kit-iniciacion-tarot',
    'Kit de iniciación al tarot (mazo + guía + bolsa)',
    'Kit completo: mazo de tarot de 78 cartas, guía de interpretación y bolsa de tela para guardar.',
    3800, 'USD', 'new', null, true
  ),
  -- Producto oculto del catálogo público (solo accesible por flash code 'unlock')
  (
    'kit-exclusivo-coleccionista',
    'Kit exclusivo (oculto del catálogo público)',
    'Kit curado para coleccionistas: mineralería selecta + piece ceremonial única. Solo accesible con código SECRETO.',
    9900, 'USD', 'used', 'excelente', false
  )
on conflict (slug) do nothing;

-- Inventario -------------------------------------------------
insert into public.inventory (product_id, stock, reserved)
select id, case slug
  when 'amazonita-pulida' then 3
  when 'cuenco-ceremonial-ceramica-negra' then 1
  when 'palo-santo-kg' then 24
  when 'colgante-cuarzo-cristal' then 8
  when 'tapiz-tejido-a-mano-imbabura' then 0
  when 'kit-iniciacion-tarot' then 5
  when 'kit-exclusivo-coleccionista' then 2
end, 0
from public.products
on conflict (product_id) do nothing;

-- Flash codes ------------------------------------------------
insert into public.flash_codes (code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active)
values
  ('MUNAY10', 'discount', 10, null, now(), now() + interval '90 days', 100, 0, true),
  ('MISTICO25', 'discount', 25, null, now(), now() + interval '30 days', 50, 0, true),
  ('SECRETO', 'unlock', null, null, now(), now() + interval '180 days', 10, 0, true)
on conflict (code) do nothing;

-- Asociación del código 'SECRETO' con el producto oculto -----
insert into public.flash_code_products (code, product_id)
select 'SECRETO', p.id
from public.products p
where p.slug = 'kit-exclusivo-coleccionista'
on conflict do nothing;
