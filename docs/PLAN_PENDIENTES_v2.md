# Plan de Pendientes v2 — Munay (Revisado por 5 revisores)

> **Última actualización:** 30/7/2026  
> **Rama actual:** `v0/munay-expansion-clean`  
> **URL:** https://munayy.vercel.app

---

## 📊 Cambios desde v1 (WhatsApp Checkout implementado)

| Pendiente v1 | Estado actual | Nota |
|:---|---|:---|
| Pago con tarjeta (Kushki) | 🔄 **Reemplazado por WhatsApp Checkout** | Ya no se necesita Kushki |
| Tabla tickets en DB | ✅ **Migración SQL creada** | `supabase/migrations/00010_tickets_whatsapp.sql` |
| Envío Ibarra/Servientrega | 🔴 **Sin cambios** | Pendiente — baja a 🟡 (se negocia en WhatsApp) |
| Fotos de productos | 🔴 **Sin cambios** | Cloudinary listo, sin fotos |
| Turnstile producción | 🟡 **Sin cambios** | Baja a 🟢 (no hay tarjeta que proteger) |
| Brevo verificar | 🟡 **Sin cambios** | Pendiente |
| Cupones fidelidad E2E | 🟡 **Sin cambios** | Pendiente |
| CRON verificar | 🟡 **Sin cambios** | Pendiente |
| Polish items (4.1-4.6) | 🟢 **Sin cambios** | Pendiente |

---

## 🔴 Fase 0: Deploy WhatsApp Checkout (15 min)

> ⚠️ **CRÍTICO:** La migración SQL debe ejecutarse **ANTES** del deploy a Vercel.  
> Si se despliega primero, el endpoint `/api/checkout/whatsapp` fallará al insertar tickets porque las columnas nuevas no existen en la DB.

### 0.1 — Ejecutar migración SQL en Neon (PRIMERO)
```sql
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('new','in_progress','completed','cancelled'));
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
```

### 0.2 — Commit + push (sin .env.local)
```bash
git add src/ supabase/ docs/
git commit -m "feat: WhatsApp checkout reemplaza pago tarjeta"
git push origin v0/munay-expansion-clean
```

### 0.3 — Deploy a Vercel producción
```bash
npx vercel --prod
```

### 0.4 — Smoke test post-deploy
1. Ir a `/catalogo` → agregar producto al carrito
2. Ir a `/checkout` → llenar datos → "Enviar pedido por WhatsApp"
3. Verificar que aparece un ticket en `/admin/tickets`
4. Verificar que aparece la orden en `/admin/orders`
5. Marcar como pagada desde `/admin/orders/[id]`
6. Verificar puntos + cupón generados

### 📋 Plan de rollback
```bash
# Si WhatsApp Checkout falla en producción:
git revert HEAD  # restaura el checkout con tarjeta
npx vercel --prod  # redeploy
# Las env vars de Kushki aún están en Vercel (no se eliminaron)
```

---

## 🔴 Fase 1: Subir fotos de productos a Cloudinary (30 min)

> Sin fotos, el usuario no agrega al carrito → no llega al checkout.  
> Priorizar fotos de los 2 productos más vendidos primero.

| Subfase | Acción |
|:---|---|
| **1.1** | Usar script bulk: `node scripts/migrate-images-to-cloudinary.mjs` |
| **1.2** | O subir manualmente desde admin: `/admin/products` → editar → subir |
| **1.3** | Verificar en `/catalogo` y `/p/[slug]` |

---

## 🟡 Fase 2: Envíos reales (2-3 sesiones)

> **Ajuste post-revisión:** Baja de 🔴 a 🟡 porque el envío se puede coordinar por WhatsApp.  
> **Fix crítico:** Ibarra es una **ciudad** (no provincia), debe manejarse en columna separada.

### 2.1 — Migración SQL `shipping_zones`
```sql
CREATE TABLE IF NOT EXISTS shipping_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name     TEXT NOT NULL,           -- provincia o 'Resto del país'
  zone_type     TEXT NOT NULL DEFAULT 'province' CHECK (zone_type IN ('city','province','default')),
  method        TEXT NOT NULL DEFAULT 'servientrega',
  price_cents   INTEGER NOT NULL,
  free_from     INTEGER,                -- gratis si subtotal >= free_from
  estimated_days TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone_name, zone_type)
);

-- Datos iniciales (con Ibarra como city, no como province)
INSERT INTO shipping_zones (zone_name, zone_type, method, price_cents, free_from, estimated_days) VALUES
  ('Ibarra', 'city', 'retiro', 0, NULL, 'Mismo día'),
  ('Imbabura', 'province', 'servientrega', 300, 5000, '1-2 días'),
  ('Pichincha', 'province', 'servientrega', 350, 5000, '1-2 días'),
  ('Guayas', 'province', 'servientrega', 450, 7000, '2-3 días'),
  ('Azuay', 'province', 'servientrega', 450, 7000, '2-3 días'),
  ('Manabí', 'province', 'servientrega', 400, 6000, '2-3 días'),
  ('Tungurahua', 'province', 'servientrega', 350, 5000, '2-3 días'),
  ('Resto del país', 'default', 'servientrega', 550, 8000, '4-5 días')
ON CONFLICT (zone_name, zone_type) DO NOTHING;
```

### 2.2 — API `POST /api/shipping/calculate`
- Input: `{ city, province, subtotal_cents }`
- Lógica: buscar por `city` primero → si no, por `province` → si no, `default`
- Output: `{ method, price_cents, free_from, estimated_days, is_free }`

### 2.3 — Checkout: al cambiar ciudad/provincia, mostrar costo en tiempo real
- Modificar `src/app/checkout/page.tsx`

### 2.4 — Admin CRUD: opcional, editar en Neon SQL Editor por ahora

---

## 🟢 Fase 3: Turnstile a producción (10 min)

> **Ajuste post-revisión:** Baja de 🟡 a 🟢 porque ya no hay formulario de tarjeta.  
> Solo protege endpoints de tickets (que ya tienen rate limiting).

### 3.1 — Crear widget en Cloudflare Dashboard
1. Ir a https://dash.cloudflare.com → Turnstile
2. Crear widget para `munayy.vercel.app`
3. Obtener Site Key + Secret Key

### 3.2 — Actualizar env vars en Vercel
```bash
npx vercel env rm NEXT_PUBLIC_TURNSTILE_SITE_KEY production
npx vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
# (repetir para TURNSTILE_SECRET_KEY)
```

---

## 🟡 Fase 4: Verificar Brevo + CRON + Cupones (30 min)

### 4.1 — Brevo: email de prueba
- Crear orden → admin marca pagada → verificar que llega email

### 4.2 — Verificar CRON en Vercel Dashboard
1. Ir a https://vercel.com/sad-d/munay-audited-v0.1/cron-jobs
2. Confirmar `expire-orders` con schedule `*/15 * * * *`
3. Probar manual: `GET /api/cron/expire-orders?key=<CRON_SECRET>`

### 4.3 — Verificar cupones E2E
1. Admin marca orden como pagada
2. Verificar cupón en `loyalty_coupons` (DB)
3. Verificar que `PendingCouponBanner` existe en `/cuenta`
4. Si no existe el banner: crearlo o mostrar el cupón en la vista de puntos
5. Verificar que `invalidateCouponByOrder()` se llama al cancelar orden

---

## 🔴 Fase 5: Ajustar CRON para órdenes WhatsApp (20 min)

> **Ajuste post-revisión:** Sube de 🟡 a 🔴 — sin esto, las órdenes de WhatsApp  
> se cancelan automáticamente después de 60 minutos.

### 5.1 — Modificar query de expiración
```sql
-- Usar NOT EXISTS (más seguro que NOT IN — evita problemas con NULLs)
WHERE status = 'pending'
  AND created_at < now() - interval '60 minutes'
  AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id)

-- Opcional: agregar límite máximo de 72h incluso para órdenes con ticket
WHERE status = 'pending'
  AND (
    (created_at < now() - interval '60 minutes' AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id))
    OR
    (created_at < now() - interval '72 hours')
  )
```

> **NO agregar columna `source` a orders** — el ticket con `order_id` ya identifica  
> las órdenes de WhatsApp. Columna redundante.

---

## 🟢 Fase 6: Polish y UX (1-2 sesiones)

| # | Mejora | Archivos | Tiempo |
|:---:|---|:---|:---:|
| **D-1** | Placeholder `ImageOff` consistente (vs `Sparkles`) | `src/components/product/product-card.tsx` | 2 min |
| **D-2** | Texto "Supabase" → "Neon" en formulario admin | `src/components/admin/product-form.tsx` | 2 min |
| 6.1 | Lightbox/zoom en galería (usar shadcn Dialog) | `src/components/product/product-gallery.tsx` | 30 min |
| 6.2 | Confirmación antes de eliminar imagen admin | `src/components/admin/image-upload.tsx` | 15 min |
| 6.3 | Página de envíos (extender `/info` existente) | `src/app/info/page.tsx` | 30 min |
| 6.4 | Overlay móvil ImageUpload (focus-within) | `src/components/admin/image-upload.tsx` | 10 min |

> **Quick wins:** D-1 y D-2 toman ~2 min c/u, hacerlos ya.

---

## 🧹 Fase 7: Limpiar código muerto (30 min)

> ⚠️ **Antes de eliminar archivos**, verificar importaciones:
> ```bash
> grep -r "payments/kushki\|payments/create\|payments/webhook" src/ --include="*.ts" --include="*.tsx"
> grep -r "PAYMENT_PROVIDER\|PAYMENT_SANDBOX\|KUSHKI" src/ --include="*.ts" --include="*.tsx"
> ```

| Archivo | Acción |
|:---|---|
| `src/app/api/payments/create/route.ts` | Eliminar |
| `src/app/api/payments/webhook/route.ts` | Eliminar |
| `src/lib/payments/kushki.ts` | Eliminar |
| `src/lib/orders.ts` | Verificar si es código muerto |
| Env var `KUSHKI_PUBLIC_KEY` | Eliminar de Vercel |
| Env var `KUSHKI_PRIVATE_KEY` | Eliminar de Vercel |
| Env var `KUSHKI_WEBHOOK_SECRET` | Eliminar de Vercel |
| Env var `PAYMENT_PROVIDER` | Eliminar de Vercel |
| Env var `PAYMENT_SANDBOX` | Eliminar de Vercel |
| Ref. a `PAYMENT` en `constants.ts` | Limpiar export obsoleto |

---

## 📋 Prioridad final post-revisión

| Prioridad | Fase | Tiempo | Por qué cambió |
|:---:|:---:|:---:|:---|
| 🔴 **0** | Deploy WhatsApp + migración SQL **ANTES** | 15 min | ⚠️ Código sin deploy |
| 🔴 **0.4** | Smoke test post-deploy | 10 min | Verificar flujo completo |
| 🔴 **5** | Ajustar CRON (excluir WhatsApp) | 20 min | ⬆️ Subió: órdenes se cancelan solas |
| 🔴 **1** | Fotos a Cloudinary | 30 min | Sin fotos = sin ventas |
| 🟡 **4** | Verificar Brevo + CRON + Cupones | 30 min | Importante no blocker |
| 🟡 **2** | Envíos reales | 2-3 sesiones | ⬇️ Bajó: se negocia por WhatsApp |
| 🟢 **3** | Turnstile producción | 10 min | ⬇️ Bajó: no hay tarjeta que proteger |
| 🟢 **6** | Polish UX | 1-2 sesiones | Sin cambios |
| 🧹 **7** | Limpiar código muerto | 30 min | Post-deploy seguro |

---

## 📁 Resumen de archivos

### Nuevos (2)
- `supabase/migrations/00011_shipping_zones.sql` — Fase 2.1
- `src/app/api/shipping/calculate/route.ts` — Fase 2.2

### Modificados (6)
- `src/app/checkout/page.tsx` — Fase 2.3
- `src/app/api/cron/expire-orders/route.ts` — Fase 5.1
- `src/components/product/product-gallery.tsx` — Fase 6.1
- `src/components/admin/image-upload.tsx` — Fase 6.2, 6.4
- `src/components/product/product-card.tsx` — Fase 6.0 D-1
- `src/components/admin/product-form.tsx` — Fase 6.0 D-2

### A eliminar (3+)
- `src/app/api/payments/create/route.ts` — Fase 7
- `src/app/api/payments/webhook/route.ts` — Fase 7
- `src/lib/payments/kushki.ts` — Fase 7
