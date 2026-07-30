-- Migración: Agregar columnas para WhatsApp Checkout a la tabla tickets existente
-- NOTA: La tabla tickets YA EXISTE (creada por el flujo de soporte), por lo que
-- usamos ALTER TABLE ADD COLUMN IF NOT EXISTS en lugar de CREATE TABLE.
-- Ejecutar en Neon SQL Editor.

-- Agregar columnas nuevas (idempotente)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Agregar CHECK constraint para status (idempotente)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled'));

-- Índices (idempotentes por diseño en Postgres)
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
