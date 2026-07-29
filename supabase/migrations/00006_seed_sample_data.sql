-- =============================================================
-- Migración 00006 (SEED — solo para desarrollo local).
-- Datos de ejemplo para probar la integración en Fase 2.
-- ⚠️  NO aplicar en producción. Marcar como idempotente.
-- =============================================================

-- Productos --------------------------------------------------
insert into public.products (slug, title, description, price_cents, currency, condition, grading, active)
values
  (
    'camiseta-algodon-organico',
    'Camiseta artesanal de algodón orgánico — talla M',
    'Camiseta de algodón orgánico 100%, tejida a mano por artesanos locales. Corte recto, talla M. Color: crudo natural.',
    300, 'USD', 'new', null, true
  ),
  (
    'chaqueta-vaquera-vintage',
    'Chaqueta vaquera vintage — talla L',
    'Chaqueta vaquera de segunda mano en buen estado. Auténtico denim de los años 90. Talla L, corte clásico.',
    700, 'USD', 'used', 'buena', true
  ),
  (
    'pantalon-lino-ecologico',
    'Pantalón de lino ecológico — talla 40',
    'Pantalón de lino 100% ecológico. Fresco, ligero y transpirable. Talla 40 (M). Corte recto, cintura elástica. Color: beige natural.',
    560, 'USD', 'new', null, true
  ),
  (
    'gorro-lana-merina',
    'Gorro tejido a mano — lana merina',
    'Gorro de lana merina 100%, tejido a mano. Talla única, diseño clásico. Color: gris perla.',
    200, 'USD', 'new', null, true
  ),
  -- Producto oculto (solo accesible por flash code 'unlock')
  (
    'mystery-box',
    '🎁 Mystery Box — Sorpresa',
    '¿Qué hay dentro? Una selección sorpresa de prendas seleccionadas especialmente para ti. Disponible pronto.',
    0, 'USD', 'new', null, true
  )
on conflict (slug) do nothing;

-- Inventario -------------------------------------------------
insert into public.inventory (product_id, stock, reserved)
select id, case slug
  when 'camiseta-algodon-organico' then 10
  when 'chaqueta-vaquera-vintage' then 3
  when 'pantalon-lino-ecologico' then 8
  when 'gorro-lana-merina' then 15
  when 'mystery-box' then 99
end, 0
from public.products
on conflict (product_id) do nothing;

-- Flash codes ------------------------------------------------
insert into public.flash_codes (code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active)
values
  ('MUNAY10', 'discount', 10, null, now(), now() + interval '90 days', 100, 0, true),
  ('MUNAY25', 'discount', 25, null, now(), now() + interval '30 days', 50, 0, true),
  ('SECRETO', 'unlock', null, null, now(), now() + interval '180 days', 10, 0, true)
on conflict (code) do nothing;

-- Asociación del código 'SECRETO' con el producto oculto -----
insert into public.flash_code_products (code, product_id)
select 'SECRETO', p.id
from public.products p
where p.slug = 'mystery-box'
on conflict do nothing;
