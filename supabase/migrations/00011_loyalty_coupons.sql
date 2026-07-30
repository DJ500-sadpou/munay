-- Migración: Tablas de cupones de fidelidad y configuración de la app
-- Ejecutar en Neon SQL Editor (o ya ejecutado automáticamente)

-- Tabla de configuración de la aplicación (key-value)
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Config inicial del sistema de cupones de fidelidad (idempotente)
INSERT INTO public.app_config (key, value)
VALUES ('loyalty_coupons', '{"enabled": true, "discount_percent": 25}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Insertar fila por defecto si no existe (para consultas que usan SELECT simple)
INSERT INTO public.app_config (key, value)
VALUES ('loyalty_coupon_settings', '{"enabled": true, "discount_percent": 25, "validity_days": 7}')
ON CONFLICT (key) DO NOTHING;

-- Tabla de cupones de fidelidad
CREATE TABLE IF NOT EXISTS public.loyalty_coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  order_id         UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  code             TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 25,
  used_at          TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON public.loyalty_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_code ON public.loyalty_coupons(code);
CREATE INDEX IF NOT EXISTS idx_loyalty_order_id ON public.loyalty_coupons(order_id);