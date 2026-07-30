-- Migración: Crear tabla tickets para WhatsApp Checkout + soporte
-- Ejecutado en Neon SQL Editor el 30/7/2026.
-- Nota: Se usó CREATE TABLE IF NOT EXISTS porque la tabla no existía en Neon.
-- Si la tabla ya existe (ej: en otro entorno), las columnas se agregan con ALTER TABLE.

CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  items       JSONB,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columnas adicionales si la tabla ya existía (idempotente)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);