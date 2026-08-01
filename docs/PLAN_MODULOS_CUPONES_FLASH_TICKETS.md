# Plan: Completar Cupones + Código Flash + Ticket WhatsApp (Módulo D)

> Stack: Next.js + Vercel + Neon (Postgres) + Clerk + Cloudflare Turnstile + Brevo.
> Basado en la auditoría del código real al 31/07/2026 (rama `master`/`redesign-v2-palette`).
> **Este documento es el PLAN — no se escribe código hasta que el plan sea aprobado por los 5 revisores.**

---

## PARTE 0 — ESTADO DE LA SEPARACIÓN CUPONES vs FLASH (checklist confirmado ✅)

La separación arquitectónica quedó **COMPLETA** en todas las capas (verificado contra el código real):

| # | Criterio de independencia | Estado | Evidencia |
|---|---|---|---|
| 1 | **Tabla `coupons` independiente** | ✅ | `supabase/migrations/00020_coupons.sql` + `00022_f0_cupones_flash.sql` (BLOQUE A). Columnas: codigo, tipo (`general`/`primera_compra`), porcentaje_descuento, monto_minimo_compra, fechas, activo, usos_maximos/actuales. |
| 2 | **Tabla `flash_codes` solo `unlock`** | ✅ | BLOQUE B aplicado en Neon (verificado contra BD real): sin `discount_percent`/`discount_cents`, enum = solo `'unlock'`. |
| 3 | **Precio especial flash por producto** | ✅ | `flash_code_products.precio_especial_cents` (NULL → price_cents). |
| 4 | **Lógica de cupones separada** | ✅ | `src/lib/queries/coupons.ts`: `validateCoupon` (preview no-consume), `getActiveCoupons`, CRUD admin completo (`createCoupon`/`updateCoupon`/`deleteCoupon`/`resetCouponUses`). |
| 5 | **Lógica flash separada** | ✅ | `src/lib/queries/products-neon.ts`: `getValidFlashCode`, `getUnlockedProducts`, `getFlashSpecialPrice` (unlock-only). |
| 6 | **Checkout NO usa flash como descuento** | ✅ | `orders-neon.ts` `createOrder`: `flash_code` legacy se IGNORA; el precio especial se aplica **por línea** vía `precio_especial_cents` (autoritativo). El descuento % solo viene de `coupons`/`loyalty_coupons`. |
| 7 | **Desambiguación FID-** | ✅ | `createOrder`: `FID-` → `loyalty_coupons`; cualquier otro → tabla `coupons`. Nunca se busca en ambas. |
| 8 | **No-acumulación (3 fuentes)** | ✅ | `createOrder` 5c-quater: solo el MAYOR de (loyalty, coupon) + puntos. Consumo SOLO del ganador con UPDATE atómico. |
| 9 | **UI admin separada** | ✅ | `/admin/coupons` (listado + `coupon-form.tsx` + `coupon-actions.tsx`) y `/admin/flash-codes` (listado + `flash-code-form.tsx` + `flash-code-products.tsx` con precio especial por producto). |
| 10 | **Vista usuario cupones** | ✅ | `src/components/munay/coupon-cards.tsx` (`MunayCouponCards`): card con código, % OFF, mínimo, countdown, botón **"Copiar código"**. |
| 11 | **Aplicación en checkout** | ✅ | `CouponCheckoutInput` + `/api/coupons/apply` (preview) + consumo en `createOrder`. Validación server-side completa (activo/fechas/usos/monto_mínimo/primera_compra). |
| 12 | **Búsqueda flash en catálogo** | ✅ parcial | `catalogo/page.tsx`: `looksLikeFlashCode` + `getValidFlashCode` → **redirige a `/flash/[code]`**. El plan F2 lo cambia a **filtrado in-page** (requisito del prompt). |

### GAPS detectados (no rompen la independencia, pero el plan los completa)

1. **Advertencia visual no-bloqueante** para `primera_compra` con % > umbral configurable (default 30%) — NO existe en `coupon-form.tsx`. Tampoco existe infraestructura de umbral configurable (no hay tabla `settings`).
2. **Filtrado de `primera_compra` por usuario**: `getActiveCoupons()` devuelve TODOS los activos sin filtrar por historial del usuario. La validación en `validateCoupon`/`createOrder` SÍ filtra server-side al aplicar, pero la **vista** muestra cupones de primera compra a usuarios que ya compraron.
3. **Guard de guests para `primera_compra` (Ronda 1)**: HOY `validateCoupon` y `createOrder` dejan que un **guest con email nuevo** aplique un cupón de primera compra (chequean `user_id OR email`, y un guest sin historial pasa). El prompt exige "no autenticados no ven **ni pueden aplicar**". Falta `if (tipo==='primera_compra' && !userId) → rechazar` en el lado de aplicación.
4. **Autogenerar código sugerido** (Ronda 1): el prompt pide "autogenerar sugerido, editable" tanto en el form de cupones como en el de flash codes — no existe botón/valor generado.
5. **Regla de no-acumulación flash-vs-cupón explícita** (mensaje al usuario): el prompt pide "calcular ambos, aplicar el mayor, mensaje explícito". Hoy el flash aplica por línea (dentro del subtotal) y el cupón sobre el subtotal; no hay comparación ni mensaje.
6. **Modal "¿Qué es un código flash?" in-page**: no existe. Hay un botón "Tengo un código flash" junto al buscador (redirige a `/flash`) que se **reutilizará/reemplazará** como trigger del modal (Ronda 1 — no duplicar botones).
7. **Tabla `settings`** (para `auto_expire_tickets_enabled` y umbral) — no existe.
8. **Número de WhatsApp hardcodeado** en `src/lib/constants.ts` (`SITE.whatsapp`) — el prompt exige env var de Vercel.

---

## PARTE 1 — DIAGNÓSTICO MÓDULO D (Ticket WhatsApp) — CAUSA RAÍZ

### Síntomas reportados por el usuario
- "Hace la animación pero no redirige a WhatsApp."
- "En /admin/tickets no sale el ticket."
- "Error al enviar pedido: demasiadas solicitudes, reintenta en 1 minuto."
- "El nombre debe tener al menos 2 caracteres" (con nombre lleno).
- "Stock insuficiente para producto X" (con stock visible en admin).

### Causas raíz identificadas (código real)

| # | Síntoma | Causa raíz | Archivo |
|---|---|---|---|
| R1 | Error "demasiadas solicitudes" | **Rate limiter de 10s** en `/api/checkout/whatsapp` bloquea reintentos rápidos (el mensaje "1 minuto" es del rate de `/api/tickets`, 60s). El usuario reintentó → 429 → nunca llega a `createOrder`. | `src/app/api/checkout/whatsapp/route.ts`, `src/app/api/tickets/route.ts` |
| R1b | Turnstile bloquea antes de `createOrder` (Ronda 1) | `requireTurnstile` falla si el widget no carga o el token expira → 400/403 sin orden, sin ticket, sin redirect. Candidato igual de probable que el rate limiter. QA: verificar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel. | `route.ts` + `src/lib/auth/turnstile.ts` |
| R2 | No redirige a WhatsApp | El redirect es **indirecto**: checkout → `router.push('/checkout/success?order=…&wa=…')` → `AutoWhatsappRedirect` abre WhatsApp tras 3s. Si el POST falla (R1/R1b/R3/R4), no hay URL → no redirige. **Doble-DECODE del param `wa` (Ronda 1)**: Next.js ya decodifica `searchParams` automáticamente, y `success/page.tsx` aplica `decodeURIComponent(sp.wa)` otra vez → la URL final contiene newlines/emojis/espacios crudos (funciona solo porque el browser re-encoda). Fix: eliminar el `encodeURIComponent` del checkout **o** el `decodeURIComponent` del success — elegir UNO. | `src/app/checkout/page.tsx`, `src/app/checkout/success/page.tsx`, `auto-whatsapp.tsx` |
| R3 | Ticket no aparece en admin | La creación del ticket es **best-effort** (`try/catch` no-bloqueante, fuera de la transacción de la orden) y ocurre **después** de `createOrder`. Si la orden falla (429/stock/validación), el ticket jamás se intenta. Si el INSERT falla, el error se traga (`console.warn`) y la respuesta sigue siendo `ok:true`. **Riesgo adicional (Ronda 1)**: `createOrder` ya COMMITEÓ cuando corre el INSERT del ticket; si el ticket falla y respondemos 500, queda **orden huérfana con stock reservado** → compensar con `markOrderCancelled(orderId)` antes de responder el error (no meter el INSERT dentro de la transacción — necesita `order_id` FK). | `src/app/api/checkout/whatsapp/route.ts` (paso 3) |
| R4 | "Nombre debe tener ≥2 caracteres" | El checkout envía `customer_name` y la route lee `body.customer_name` — CORRECTO hoy. El error se disparaba cuando el nombre llegaba vacío (pestaña vieja / autofill fallido / re-submit tras limpiar). Verificar en QA real. | `route.ts` línea de validación |
| R5 | "Stock insuficiente" | `createOrder` valida `available = stock - reserved`. Una orden pendiente previa (o reintento) deja stock **reservado** sin expirar → el siguiente intento falla aunque admin muestre stock. El cron `expire_stale_orders_v2(60,72)` libera, pero entre reintentos el usuario ve el error. | `orders-neon.ts` paso 4 |
| R6 | **Esquema de tickets incompleto** vs. requisito | La tabla `tickets` actual (00010) tiene: `id, order_id, name, email, phone, message, items, status ('new'|'in_progress'|'completed'|'cancelled'), created_at, updated_at`. **Faltan**: `ticket_numero` (4 dígitos), `clerk_user_id`, `precio_total`, `descuento_aplicado`, `fecha_expiracion` (+48h), y el estado `'pendiente'|'expirado'|'confirmado'` de pedido. | `supabase/migrations/00010_tickets_whatsapp.sql` |
| R7 | **Reserva de stock no ligada a expiración de ticket** | La reserva vive en `inventory.reserved` (por orden), expira por el cron de órdenes (60min/72h), NO por `fecha_expiracion` del ticket (+48h). | `00012`/`00022` RPC |
| R8 | WhatsApp hardcodeado | `SITE.whatsapp` en `constants.ts` — no es env var de Vercel. | `src/lib/constants.ts` |

### Decisión de arquitectura para el Módulo D (propuesta + Ronda 1)
- **Una sola tabla `tickets`** evolucionada (no tabla nueva): se agregan columnas de pedido y el CHECK de estado se amplía a `('new','in_progress','completed','cancelled','pendiente','expirado','confirmado')`, preservando tickets de soporte existentes.
- La creación del ticket pasa a ser **parte del flujo principal** de `/api/checkout/whatsapp` (fallo del ticket = **compensación**: `markOrderCancelled(orderId)` + respuesta de error visible, nunca `ok:true` silencioso).
- `ticket_numero` atómico: secuencia + **índice único parcial** (Ronda 1) `UNIQUE INDEX ON tickets (ticket_numero) WHERE status IN ('pendiente','confirmado')` + retry de colisión en app.
- **Un solo cron** (Ronda 1 — evita doble liberación de inventario): extender `expire_stale_orders_v2`/route existente en lugar de crear un cron separado. Alinear `fecha_expiracion` del ticket con la ventana del RPC (72h para órdenes con ticket) y marcar `tickets→expirado` dentro de la misma RPC. El toggle `auto_expire_tickets_enabled` se lee en la route `/api/cron/expire-orders` existente.
- **Fuente única de "primera compra"** (Ronda 1): `orders.status='paid'` + la acción admin "Confirmar" ticket debe **SIEMPRE** marcar la orden `paid` (incondicional) para que la detección de primera_compra no se rompa.

---

## PARTE 2 — CUPONES (completar funcionalidad)

### F1.1 — Advertencia visual `primera_compra` + umbral configurable
- **Umbral**: crear tabla `settings` (migración 00023) con `key='coupon_first_purchase_warning_threshold'`, `value='30'` y helpers `getSetting(key, default)` + `updateSetting(key, value)` en `src/lib/queries/settings.ts` (Ronda 2: lectura Y escritura en un solo módulo). **Reutilizar la misma tabla** para `auto_expire_tickets_enabled` (Parte 4). Fallback: constante en `constants.ts` (default 30).
- **Cómo llega al form (Ronda 1)**: `coupon-form.tsx` es `'use client'` — las páginas server `/admin/coupons/new` y `/admin/coupons/[id]` leen el umbral con `getSetting()` y lo pasan como **prop** `warningThreshold` al form. No construir una sección de settings completa solo para este umbral (evitar scope creep).
- **UI**: en el form, si `tipo === 'primera_compra'` y `porcentaje > umbral` mostrar advertencia no-bloqueante: *"Un descuento alto en cupones de primera compra puede generar pérdida si no está calibrado contra tu margen. Verifica antes de activar."* (banner ámbar, no impide guardar).
- **Autogenerar código (Ronda 1+2)**: botón "Generar" junto al campo código → sugiere **solo alfanumérico** (Ronda 2: las regex de validación `/^[A-Z0-9]+$/` y `^[a-zA-Z0-9]+$` de `looksLikeFlashCode` NO aceptan guiones): formato `MUNAY` + 4 caracteres aleatorios de `A-Z0-9` (estilo `MUNAY25`). Aplicar en cupones Y flash codes (repetir en F2.1).
- **Protección admin (Ronda 1)**: confirmar `requireAdmin()` en `new`, `[id]` y las API routes `/api/admin/coupons*` (no solo en el listado).

### F1.2 — Detección de "primera compra" (server-side)
- `validateCoupon()` y `createOrder` ya consultan `orders WHERE status='paid'` por `user_id` o `email`. ✅ (fuente correcta: el enum real es `('pending','paid','cancelled','refunded')` — **no existe 'confirmado'** en orders; usar `'paid'`, no copiar el 'confirmado' del prompt).
- **Refuerzo display**: crear `getActiveCouponsForUser(userId, email)` en `coupons.ts` que filtra `primera_compra` si el usuario tiene órdenes pagadas. Guests (`null, null`) → NO incluir `primera_compra`.
- **Refuerzo aplicar (Ronda 1+2 — CRÍTICO)**: `if (tipo === 'primera_compra' && !userId) → rechazar`. Son **2 puntos reales** (Ronda 2): `validateCoupon` cubre transitivamente `/api/coupons/apply` (la ruta lo invoca) + `createOrder` (lógica inline). En `/api/coupons/apply`, el `userId` se obtiene vía `auth()` de Clerk en servidor (NUNCA del body del cliente — spoofing).
- **Ronda 2**: el wrapper `safeFetchActiveCoupons()` en `page.tsx` no tiene contexto de usuario — el server component pasará `userId`/`email` (de `currentUser()`) a `getActiveCouponsForUser` (no solo "sustituir la llamada").

### F1.3 — Vista de usuario (sección cupones del catálogo)
- `page.tsx` (landing): sustituir `getActiveCoupons()` por `getActiveCouponsForUser(userId, email)` (server-side, vía `currentUser()`).
- `MunayCouponCards`: agregar **badge "Primera compra"** cuando `tipo === 'primera_compra'` (el botón "Copiar código" ya existe ✅).

### F1.4 — Aplicación en checkout (ya completa ✅)
- `CouponCheckoutInput` + `/api/coupons/apply` + consumo atómico en `createOrder` con validación completa. **Sin cambios** salvo verificación QA end-to-end.

---

## PARTE 3 — CÓDIGO FLASH (completar funcionalidad)

### F2.1 — Admin: selector de productos (ya existe, se refina)
- `flash-code-form.tsx` (código, fechas, usos, activo) + `FlashCodeProductsManager` (asocia productos con `precio_especial_cents`). ✅
- **Refinamiento**: verificar que el multi-select tenga **buscador real** sobre el catálogo (`listAllProductsForAdmin`) — si no lo tiene, implementarlo. Mostrar % de descuento derivado. Autogeneración de código (Ronda 2): repetir el botón "Generar" alfanumérico de F1.1 en este form.
- **Listado admin (Ronda 1+2)**: la página `/admin/flash-codes` NO muestra los productos asociados ni precios. Agregar resumen de productos + precio especial por fila — técnica: `array_agg` en la query del listado o `getUnlockedProducts(code)` por código (Ronda 2: especificar la técnica para no quedar ambiguo).

### F2.2 — Barra de búsqueda del catálogo → **filtrado in-page** (cambio de destino del redirect + filtro real)
- El param `?flash=` YA existe (`parseFiltersFromSearchParams` → `f.flashCode`). El cambio es un **swap de destino**: en `catalogo/page.tsx`, si `q` parece código válido → `redirect('/catalogo?flash=' + code)` (en vez de `redirect(ROUTES.flash(code))`).
- **Ronda 2 — CRÍTICO**: hoy `listProducts` con `flashCode` solo **marca** los productos desbloqueados, NO los filtra (y los P2P siguen apareciendo). Para cumplir "mostrar únicamente esos productos": cuando `flashCode` activo, agregar `WHERE p.id IN (SELECT product_id FROM flash_code_products WHERE code = $X)` a la query de productos del admin Y `includeP2P = false`.
- **Detalle crítico (Ronda 1)**: al detectar código válido, **eliminar `q`** y fijar `flash` (o que `listProducts` ignore `q` cuando `flashCode` activo) para no filtrar por `title ILIKE %CODE%`. Sincronizar `CatalogSearch` para que lea su valor inicial del param `flash`.
- Mostrar badge **"Código Flash aplicado ⚡"** + precio especial visible + banner existente de `activeFlashInfo`.
- Si no es válido: búsqueda normal + aviso existente. Mantener `/flash/[code]` como respaldo de enlace directo (deja de ser el destino del redirect).

### F2.3 — Modal "¿Qué es un código flash?" in-page
- **Reutilizar el botón existente** "Tengo un código flash" (junto al buscador, hoy enlaza a `/flash`) como trigger del `Dialog` (shadcn) DENTRO del catálogo (Ronda 1 — no añadir un segundo botón). Crear `src/components/catalogo/flash-help-dialog.tsx`.
- Contenido: qué es un código flash, dónde escribirlo (señalando visualmente la barra de búsqueda), ejemplo de cómo se ve un resultado válido aplicado.

### F2.4 — Regla de no-acumulación flash vs cupón (en el cálculo final)
- En `createOrder`: cuando un ítem usa `precio_especial_cents` (flash) Y hay `coupon_code`/`loyalty_code`:
  1. **Calcular `regularSubtotalCents = Σ price_cents`** (Ronda 2) además del subtotal con flash, y `flashSavings = regularSubtotalCents − subtotalCents`.
  2. **Ganador con 3 competidores** (Ronda 2): `winner = max(flashSavings, loyaltyDiscount, couponDiscount)` — el plan anterior omitía el `loyalty_code` (FID-).
  3. **Consumo condicional del cupón (Ronda 1 — CRÍTICO)**: si el ganador es flash, NO incrementar `usos_actuales` ni insertar en `coupon_usages` (no gastar el cupón del usuario). Si gana cupón/FID-: total = `regularSubtotalCents − winner − puntos` (los ítems flash vuelven a precio regular; de lo contrario se acumularían).
  4. **Contrato de respuesta**: devolver `promo_applied: 'flash'|'coupon'|'loyalty'|'none'` + `flash_discount_percent` (derivado de `precio_especial_cents`). **Transporte a success (Ronda 2)**: pasar por query params en el redirect del checkout (`&promo=flash&flashPct=25&couponPct=10`) — createOrder corre server-side en POST; el checkout es cliente y no conoce el resultado.
  5. Mensaje: *"Este producto ya tenía un descuento especial de Código Flash (X% OFF), mayor a tu cupón (Y% OFF). Se aplicó el descuento de Código Flash. Los descuentos no son acumulables en Munay."*
  6. **Nota**: el preview del checkout muestra `max(coupon, loyalty)` sin flash → mismatch de display pre-existente; documentarlo.
- La arquitectura interna de ambos sistemas permanece independiente (solo se cruzan en este punto).

### F2.5 — Flash JAMÁS aparece en checkout (ya garantizado ✅)
- No hay campo de entrada de flash en checkout; `flash_code` en el body solo trae el código de línea (precio especial) — no es un "aplicar cupón".

---

## PARTE 4 — TICKET DE WHATSAPP (módulo completo)

### F3.0 — Fixes de causa raíz (pre-requisito)
1. **Rate limiter**: subir `/api/checkout/whatsapp` a 10-15s con mensaje que muestre segundos restantes (Ronda 2: 20-30s frustraría un reintento legítimo tras Turnstile expirado). Mensaje de `/api/tickets` ajustado a su propio límite.
2. **Creación de ticket con compensación (Ronda 1+2)**: el INSERT del ticket pasa a **flujo principal**. Si falla → `markOrderCancelled(orderId)` envuelto en su propio try/catch (Ronda 2: si la compensación misma falla, la respuesta sigue siendo un 500 claro) + respuesta de error visible 500/422. NUNCA `ok:true` silencioso y NUNCA orden huérfana.
3. **Redirect robusto (Ronda 1+2)**: eliminar el **doble-decode** — mantener `encodeURIComponent` en el checkout y **eliminar el `decodeURIComponent` en success** (Next ya decodifica searchParams una vez; quitarlo del lado equivocado rompería el query string del `wa`). Normalizar número `wa.me/593…` (sin `+`). Fallback: botón "Abrir WhatsApp" manual (ya existe).
4. **Stock**: QA real de `available = stock - reserved`; el mensaje de error ya muestra disponible.
5. **Ronda 2 — QA Turnstile**: verificar qué hace `requireTurnstile` cuando `NEXT_PUBLIC_TURNSTILE_SITE_KEY` NO está configurada (¿omite o falla?) — define si es bloqueador real en producción.

### F3.1 — Migración 00023: evolución de tabla `tickets` + tabla `settings`
```sql
-- settings (toggle + umbral configurable — un solo mecanismo)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.settings (key, value)
VALUES ('auto_expire_tickets_enabled', 'true'),
       ('coupon_first_purchase_warning_threshold', '30')
ON CONFLICT (key) DO NOTHING;

-- tickets: columnas de pedido (reutiliza `items` como carrito — no duplicar)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_numero INTEGER;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS precio_total_cents INTEGER;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS descuento_aplicado JSONB;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS fecha_expiracion TIMESTAMPTZ;

-- ampliar CHECK de estado (conserva soporte + pedido)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('new','in_progress','completed','cancelled','pendiente','expirado','confirmado'));

-- secuencia para ticket_numero de 4 dígitos (0000-9999)
CREATE SEQUENCE IF NOT EXISTS public.ticket_numero_seq START 1 MAXVALUE 9999 CYCLE;

-- [Ronda 1] índice único parcial: garantía DB de no-colisión entre activos
CREATE UNIQUE INDEX IF NOT EXISTS tickets_numero_active_idx
  ON public.tickets (ticket_numero) WHERE status IN ('pendiente','confirmado');
```
- `ticket_numero` se asigna al crear un ticket de pedido: `nextval` + retry hasta 10 veces si colisiona con activos (el índice parcial respalda). Display con `LPAD(numero::text, 4, '0')`.
- **Ventana de expiración alineada (Ronda 1)**: `fecha_expiracion = now() + interval '72 hours'` (coincide con la ventana whatsapp del RPC `expire_stale_orders_v2` para evitar doble cron / liberación duplicada). El prompt pedía 48h; se documenta la alineación a 72h como decisión (o ajustar el RPC a 48h — NO ambos valores).
- Backfill: `UPDATE tickets SET fecha_expiracion = created_at + interval '72 hours' WHERE fecha_expiracion IS NULL`.

### F3.2 — Reserva de stock ligada al ticket
- `createOrder` ya reserva vía `reserve_inventory` (dentro de la transacción). ✅
- El **cron de tickets** libera al expirar: al pasar `pendiente → expirado`, invocar `release_inventory` por cada ítem de `order_items` de la orden asociada (reutilizando `expire_stale_orders_v2` con la ventana de tickets).

### F3.3 — Flujo de generación y redirección
1. `/api/checkout/whatsapp`: `createOrder` → INSERT ticket (número con LPAD, clerk_user_id, `items` como carrito, precio_total_cents, descuento_aplicado, estado `pendiente`, expira +72h alineado).
2. Mensaje prearmado: `*Ticket #1234*\n🛍️ Productos…\n💰 Total…\n🏷️ Descuento…\n` — con `encodeURIComponent` (verificado correcto: `\n`→`%0A`, emojis OK).
3. Redirigir a `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=...` (normalizar a dígitos, sin `+`).
4. **Mover WhatsApp a env var**: `NEXT_PUBLIC_WHATSAPP_NUMBER` (Vercel, se inlinea en build — configurar antes del deploy) con fallback al actual en `constants.ts`; actualizar `SITE.whatsapp`/`whatsappLink`. El link de admin por ticket usa `ticket.phone` (teléfono del CLIENTE) — no se ve afectado.
5. **Brevo (opcional, marcado como PENDIENTE)**: email al admin "Nuevo ticket #XXXX" — implementar si el usuario lo confirma.

### F3.4 — Cron de expiración con toggle (extender el existente — Ronda 1+2)
- **NO crear cron separado** (evita doble `release_inventory`). **Desviación declarada del prompt** (Ronda 2): el prompt pide una route `/api/cron/expire-tickets` + entrada en `vercel.json`; se reemplaza por extender la route existente `/api/cron/expire-orders` + RPC, cumpliendo los requisitos reales del prompt (transición `pendiente→expirado`, liberación de stock, toggle) dentro de la RPC extendida.
- **Ronda 2 — firma de la RPC**: `expire_stale_orders_v2` hoy procesa SIEMPRE whatsapp. Agregar parámetro `p_process_whatsapp boolean DEFAULT true`; si `false` (toggle desactivado), saltar las ramas whatsapp (select de órdenes Y marcado de tickets). Sin esto el toggle es cosmético.
- **Ronda 2 — `fecha_expiracion` como fuente de verdad**: la rama whatsapp de la RPC debe usar `t.fecha_expiracion < now()` (equivalente al corte 72h si se alinean) y marcar `tickets→'expirado'` **en el mismo paso** que libera inventario (una sola liberación, idempotente: solo tickets de órdenes `pending` seleccionadas en esa corrida).
- La route lee `settings['auto_expire_tickets_enabled']` (con `getSetting`) y llama a la RPC con `p_process_whatsapp = valor`. Protegida por `CRON_SECRET` (timing-safe, ya implementado).
- `vercel.json`: mantener el cron existente de expire-orders cada 15min (no agregar otro).

### F3.5 — Panel admin de tickets (evolución)
- `src/app/admin/tickets/page.tsx` + `/api/admin/tickets` (GET y PATCH `[id]`): agregar columnas **Número** (#1234 — LPAD 4), **Total**, **Expiración**, estados `pendiente/expirado/confirmado`. **Actualizar la whitelist del GET, la validación del PATCH, Y el tipo `TicketStatus` + `STATUS_CONFIG` + `STATUS_TRANSITIONS` + fila de filtros del page client** (Ronda 2: definir transición `pendiente→confirmado` para que el botón "Confirmar" aparezca en la UI).
- Acción **"Confirmar"** (coordinación de pago hecha) → `confirmado` Y **SIEMPRE marcar la orden `paid`** (Ronda 1 — fuente única para primera_compra). Reutilizar `markOrderPaid` (ref sintético `whatsapp-manual-<ticket>`; verificar largo de `payments.provider_ref` y comportamiento con órdenes guest — Ronda 2).
- **Toggle `auto_expire_tickets_enabled`** visible en esta vista (PATCH a `settings` vía `updateSetting`).
- Mantener las transiciones de soporte existentes (`new/in_progress/completed/cancelled`).

---

## PARTE 5 — ORDEN DE EJECUCIÓN Y VALIDACIÓN

| Fase | Contenido | Validación |
|---|---|---|
| F0 | Migración 00023 (settings + tickets) — SQL listo para Neon | Revisión 5 revisores + ejecución en Neon |
| F1 | Cupones (umbral + advertencia + getActiveCouponsForUser + badge) | typecheck + 5 revisores |
| F2 | Flash (filtrado in-page + modal + no-acumulación) | typecheck + 5 revisores |
| F3 | Tickets (fixes R1-R5 + esquema + cron + panel admin) | typecheck + 5 revisores + QA end-to-end |
| F4 | Deploy producción + QA real del flujo completo | Vercel + 5 revisores |

Cada fase termina con: `npm run typecheck` → 5 code-reviewers en paralelo → corregir → re-revisar → recién después avanzar.

---

## PARTE 6 — ENTREGABLES / CHECKLIST FINAL

- [ ] Separación cupones/flash: confirmada COMPLETA (sección 0).
- [ ] Diagnóstico Módulo D: entregado (sección 1) con causas R1-R8 + R1b + R2 refinado.
- [ ] CRUD Cupones funcional (admin + vista usuario + checkout) + umbral/advertencia + autogenerar código alfanumérico + `requireAdmin` en todas las páginas/API.
- [ ] **Guard guests primera_compra** en `validateCoupon` (cubre /api/coupons/apply) + `createOrder` — `userId` de `auth()` server-side, nunca del body (Ronda 2).
- [ ] `getActiveCouponsForUser` usado en la landing con contexto de usuario (Ronda 2).
- [ ] Flujo Código Flash: filtrado REAL en `listProducts` (WHERE IN + includeP2P=false) + redirect a `?flash=` + badge + modal + autogenerar (Ronda 2).
- [ ] No-acumulación flash/cupón/FID- con `regularSubtotalCents`, consumo condicional y contrato `promo_applied` + transporte por query params (Ronda 2).
- [ ] Flujo Ticket WhatsApp: pagar → ticket # → stock reservado → WhatsApp con mensaje correcto → panel admin (confirmar/expirar) → cron único con toggle real (`p_process_whatsapp` en la RPC, Ronda 2).
- [ ] Fix doble-decode del param `wa` (eliminar decode en success) + compensación `markOrderCancelled` si falla el ticket (Ronda 2).
- [ ] `fecha_expiracion` leída por la RPC como fuente de verdad (no decorativa) + índice único parcial (Ronda 2).
- [ ] WhatsApp por env var de Vercel (fallback en constants).
- [ ] Migración 00023 aplicada en Neon **antes** del deploy F4 (Ronda 2 — paso explícito).
- [ ] Paleta terracota/crema en las UIs nuevas (badge, dialog, panel) — nunca `munay-red` (Ronda 2).
- [ ] **DECISIONES PENDIENTES DEL USUARIO** (Ronda 2): (a) ventana de expiración de tickets 48h (prompt) vs 72h (petición anterior); (b) desviación aprobada: un solo cron en vez de `/api/cron/expire-tickets` separado.
- [ ] Marcado como PENDIENTE: email Brevo al admin (requiere confirmación del usuario).
