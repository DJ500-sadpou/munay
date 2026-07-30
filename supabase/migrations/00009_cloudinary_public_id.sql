-- =============================================================
-- ⚠️  ATENCIÓN: Este proyecto usa NEON, no Supabase.
--    NO USES 'npx supabase migration up' — no funcionará.
--    
--    EJECUTA ESTE SQL MANUALMENTE EN:
--    https://console.neon.tech → tu proyecto → SQL Editor
-- =============================================================
-- Migración 00009 — Agregar columna public_id a product_images
-- para guardar el ID de Cloudinary y poder generar URLs
-- optimizadas dinámicamente.
-- =============================================================

alter table public.product_images
  add column if not exists public_id text;

comment on column public.product_images.public_id is
  'Cloudinary public_id para generar URLs optimizadas on-the-fly con getOptimizedImageUrl().';
