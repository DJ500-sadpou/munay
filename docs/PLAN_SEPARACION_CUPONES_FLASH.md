# Plan de Separación: CUPONES vs CÓDIGO FLASH — v2 (revisado con 5 revisores)

> ⚠️ **NOTA DE IMPLEMENTACIÓN (F4):** este plan se implementó en la migración **00022**
> (F0 BLOQUE A aplicado + BLOQUE B validado), **no** en la 00019 que aparece en los
> pasos siguientes. El SQL real incorpora los fixes de COALESCE/ON CONFLICT, el drop
> del constraint `flash_codes_check1` (error 42883) y `coupons_backup.type` → text.
> Ver `supabase/migrations/00022_f0_cupones_flash.sql`.

> **Propósito:** Desacoplar dos sistemas de negocio que quedaron mezclados en la arquitectura.
> El diagnóstico del prompt es CORRECTO — la auditoría confirmó el acoplamiento en todas las capas.
>
> Stack: Next.js + Vercel + Neon (Postgres) + Clerk + Cloudflare Turnstile + Brevo.

---

## REVISIÓN RONDA 1 — 5 revisores en paralelo (CONSOLIDADA ✅)

| # | Ángulo | Severidad | Hallazgo | Fix incorporado en v2 |
|---|---|---|---|---|
| 1 | SQL | 🔴 Crítico | NULLs en `fecha_fin`/`porcentaje_descuento` rompen el `INSERT ... SELECT` masivo | `COALESCE(ends_at, now() + interval '30 days')` + `COALESCE(discount_percent, 15)` con reporte |
| 2 | SQL | 🔴 Crítico | Falta `DELETE` explícito de filas `type='discount'` antes del `ALTER TYPE` (la cast fallaría) | Orden explícito: INSERT → DELETE → ALTER enum |
| 3 | SQL | 🔴 Crítico | FKs huérfanas en `flash_code_products` al borrar códigos discount | Limpieza de la puente antes del DELETE |
| 4 | SQL | 🔴 Crítico | Sin transacción ni idempotencia | `BEGIN/COMMIT` + `ON CONFLICT (codigo) DO NOTHING` + backup table |
| 5 | SQL | 🟡 Medio | `discount_cents → %` ambiguo sin precio de referencia | `COALESCE(discount_percent, 15)` + reporte de filas por fallback |
| 6 | SQL | 🟡 Medio | Semántica de `precio_especial_cents` NULL sin definir | NULL → se usa `price_cents` del producto; comentario en la columna |
| 7 | Backend | 🔴 Alto | Cupón consumido pero orden expira/cancela → uso perdido | Columna `order_id` en `coupons` + reversión de `usos_actuales` al expirar/cancelar |
| 8 | Backend | 🔴 Alto | Carritos persistidos con `flashCode` en localStorage | Bump de versión del store (`version: 2`) que invalida el estado viejo |
| 9 | Backend | 🔴 Alto | Materialización del precio flash + mensaje WhatsApp sub-especificado | Line-item con `unitPriceOverride` + `flashCode`; cálculo exacto no-acumulativo; WhatsApp muestra el descuento que ganó |
| 10 | Backend | 🟡 Medio | Código muerto que queda vivo (RPC, `api/flash/validate`, fuente de `live-codes`) | `DROP FUNCTION IF EXISTS consume_flash_code()`; eliminar `api/flash/validate`; `live-codes` → lee `coupons` |
| 11 | Backend | 🟡 Medio | `primera_compra` sin query de validación; payloads legacy | Query exacta + `createOrder` ignora `flash_code` legacy silenciosamente |
| 12 | UX/UI | 🔴 Alto | Punto de aplicación del cupón inconsistente (eliminar O convertir) | Se compromete: convertir `cart-flash-code-input` en campo de cupón en `/checkout` con feedback |
| 13 | UX/UI | 🟡 Medio | Confusión de naming: "Ofertas Flash" mostraría cupones | Renombrar sección a "Cupones y Ofertas" + nuevos componentes `coupon-cards.tsx` |
| 14 | UX/UI | 🟡 Medio | Pérdida de urgencia (countdown) en cards de cupón | Conservar countdown de `fecha_fin` en las cards |
| 15 | UX/UI | 🟡 Medio | Gestión de usos en admin no detallada | Mostrar `usos_actuales/usos_maximos`, botón reset, estado "agotado" |
| 16 | Impacto | 🔴 Alto | Destino de `/flash` (lista pública) sin resolver | `/flash` redirige a catálogo; `/flash/[code]` se mantiene; los cupones se listan en "Cupones y Ofertas" |
| 17 | Impacto | 🔴 Alto | Desambiguación loyalty vs coupon + no-acumulación con 3 fuentes | Lookup por prefijo `FID-` (loyalty) vs `coupons`; regla "solo el mayor de las 3" |
| 18 | Impacto | 🟡 Medio | Unlock codes sin productos vinculados + precios congelados | Reportar huérfanos en migración; documentar congelamiento del precio flash |
| 19 | Edge | 🔴 Crítico | Orden de despliegue código-vs-migración | **Deployar primero el código** (F1/F3), **luego ejecutar 00019** en Neon |
| 20 | Edge | 🔴 Alto | Sin plan de rollback | Backup tables + `git revert` documentado |
| 21 | Edge | 🟡 Medio | Normalización de códigos (case/espacios) | `btrim(upper(codigo))` + `unique index on lower(codigo)` |
| 22 | Edge | 🟡 Medio | Rename de campo `flash_code` → `coupon_code` en checkout WhatsApp | Coordinar API route + mensaje del ticket |

**Veredicto de la ronda:** el plan v1 era estructuralmente correcto pero NO estaba listo para pegar en Neon. Los fixes obligatorios son: #1–4 (SQL), #7–9 (backend), #16–17 (impacto) y #19–20 (despliegue).

---

## PASO 1 — AUDITORÍA OBLIGATORIA (COMPLETADA ✅)

### Mapa del acoplamiento actual (archivos reales)

| Capa | Archivo | Acoplamiento |
|---|---|---|
| DB | `supabase/migrations/00001_init_schema.sql` | `flash_codes.type` enum = `('discount','unlock')` — **una sola tabla** para ambos conceptos. `discount_percent`/`discount_cents` solo tienen sentido para `discount`. `flash_code_products` para `unlock`. |
| DB | `supabase/migrations/00007_rpc_atomic_operations.sql` | `consume_flash_code(p_code)` — RPC atómica que consume 1 uso y devuelve `{ type, discount_percent, discount_cents }`. Misma función para cupón y flash. |
| Backend | `src/lib/orders-neon.ts` (`createOrder`) | Dentro de la **misma transacción**: (a) `consume_flash_code` si hay `flash_code`, (b) `UPDATE loyalty_coupons` si hay `loyalty_code`, (c) `redeem_points`. Ambos descuentos se suman → **el código flash actúa como cupón general en el checkout**. |
| Checkout | `src/app/api/checkout/whatsapp/route.ts` | Envía `flash_code` + `loyalty_code` + `points_to_redeem` a `createOrder`. |
| UI carrito | `src/components/cart/cart-flash-code-input.tsx` | El usuario escribe el código EN EL CARRITO y lo aplica como descuento (`type 'discount'`). Comportamiento "cupón" incorrecto para un flash code. |
| Store | `src/store/cart.ts` | `flashCode: CartFlashCode` con `type: 'discount' | 'unlock'`; `discountCents()` aplica el % sobre el subtotal. |
| Catálogo | `src/components/catalogo/catalog-search.tsx` + `src/app/catalogo/page.tsx` | ✅ **Comportamiento flash CORRECTO ya existe**: si `q` parece código (`looksLikeFlashCode`) y es válido (`getValidFlashCode`), redirige a `/flash/[code]`. |
| Página flash | `src/app/flash/[code]/page.tsx` | ✅ Muestra productos asociados (`getUnlockedProductIds`) con precio especial. El destino correcto. |
| Página flash | `src/app/flash/page.tsx` | Lista pública de códigos — **destino a resolver** (ver PASO 4). |
| Admin | `src/app/admin/flash-codes/*` + `src/components/admin/flash-codes/flash-code-form.tsx` | **Una sola sección** "Flash codes" con selector de `type` (discount/unlock). Mezcla ambos formularios. |
| Admin API | `src/app/api/flash-codes/*` (route, `[code]`, `[code]/products`) | CRUD único para ambos tipos. |
| Público | `src/components/munay/live-codes.tsx` + `live-code-card.tsx` | Muestra códigos con % descuento públicamente (los "cupones" visibles). |
| Loyalty | `supabase/migrations/00011_loyalty_coupons.sql` + `src/lib/queries/loyalty-coupons.ts` + `loyalty-coupon-checkout.tsx` | ✅ Ya es un sistema SEPARADO (FID-xxx, por usuario, 20-30%). Se mantiene como tercer sistema. |

### Conclusión del diagnóstico
- **SÍ hay acoplamiento real**: la tabla `flash_codes`, la RPC `consume_flash_code`, el checkout `createOrder`, el carrito UI y el admin comparten lógica entre "cupón de descuento general" y "código flash de descubrimiento".
- El comportamiento flash correcto (búsqueda → redirección → producto especial) **ya existe** en `catalog-search.tsx` / `catalogo/page.tsx` / `flash/[code]`.
- El problema está en que el **mismo código** también se puede aplicar como cupón en el carrito/checkout, y en que **el admin los gestiona juntos**.

---

## PASO 2 — SEPARACIÓN DE ESQUEMA DE DATOS (Neon) — migración 00019

### Nuevo modelo objetivo

**Tabla `coupons`** (NUEVA — migración 00019):
```sql
create table public.coupons (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique check (char_length(codigo) between 4 and 32),
  tipo                  text not null check (tipo in ('general', 'primera_compra')),
  porcentaje_descuento  integer check (porcentaje_descuento between 0 and 100),
  monto_minimo_compra   integer not null default 2000 check (monto_minimo_compra >= 0), -- centavos (default $20)
  fecha_inicio          timestamptz not null default now(),
  fecha_fin             timestamptz not null,
  activo                boolean not null default true,
  usos_maximos          integer check (usos_maximos is null or usos_maximos > 0),
  usos_actuales         integer not null default 0 check (usos_actuales >= 0),
  order_id              uuid,  -- [FIX #7] referencia a la orden que consumió el cupón (para reversión)
  created_at            timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);
create unique index coupons_codigo_lower_idx on public.coupons (lower(codigo)); -- [FIX #21]
```

**Tabla `flash_codes`** (REFACTOR — quitar `discount`, dejar SOLO `unlock`):
- Eliminar el valor `'discount'` del enum `flash_code_type` (queda solo `'unlock'`).
- Eliminar columnas `discount_percent` / `discount_cents`.
- Mantener `flash_code_products` + añadir columna `precio_especial_cents` (por producto; NULL → se usa `price_cents`, [FIX #6]).

**Tabla `loyalty_coupons`**: se mantiene intacta (tercer sistema, ya separado).

### Migración de datos (00019) — patrón con fixes de la Ronda 1

```sql
begin;

-- [FIX #4] Backup para rollback
create table if not exists coupons_backup as
  select * from public.flash_codes where type = 'discount';
create table if not exists flash_code_products_backup as
  select * from public.flash_code_products;

-- Verificación previa
select count(*) as discount_codes_to_migrate
from public.flash_codes where type = 'discount';

-- [FIX #1] INSERT con COALESCE para NULLs (fecha_fin, porcentaje)
insert into public.coupons (codigo, tipo, porcentaje_descuento, monto_minimo_compra, fecha_inicio, fecha_fin, activo, usos_maximos, usos_actuales)
select
  code,
  'general',
  coalesce(discount_percent, 15),                        -- fallback documentado
  monto_minimo_compra_default,                            -- 2000
  coalesce(starts_at, now()),
  coalesce(ends_at, now() + interval '30 days'),          -- fallback documentado
  active,
  max_uses,
  uses_count
from public.flash_codes
where type = 'discount'
on conflict (codigo) do nothing;                          -- [FIX #4] idempotencia

-- [FIX #3] Limpiar FKs de la puente antes de borrar códigos discount
delete from public.flash_code_products
where flash_code_id in (select id from public.flash_codes where type = 'discount');

-- [FIX #2] DELETE explícito ANTES de alterar el enum (la cast fallaría si quedan filas discount)
delete from public.flash_codes where type = 'discount';

-- [FIX #7] Patrón exacto para quitar un valor de enum en Postgres 16
create type flash_code_type_new as enum ('unlock');
alter table public.flash_codes
  alter column type type flash_code_type_new
  using (type::text::flash_code_type_new);
drop type flash_code_type;
alter type flash_code_type_new rename to flash_code_type;

-- [FIX #6] Precio especial por producto en la puente (para unlock codes con % previo)
alter table public.flash_code_products
  add column if not exists precio_especial_cents integer; -- NULL → usar price_cents

-- [FIX #8] Fórmula % → precio especial: round(price_cents * (1 - discount_percent/100))
update public.flash_code_products fcp
set precio_especial_cents = round(p.price_cents * (1 - fc.discount_percent::numeric / 100))
from public.flash_codes fc, public.products p
where fcp.flash_code_id = fc.id
  and fcp.product_id = p.id
  and fc.discount_percent is not null
  and fcp.precio_especial_cents is null;

alter table public.flash_codes drop column if exists discount_percent;
alter table public.flash_codes drop column if exists discount_cents;

-- [FIX #10] Eliminar RPC obsoleta (ya no se usará en checkout)
drop function if exists public.consume_flash_code(text);

-- Reporte final
select count(*) as coupons_created from public.coupons;
select id, codigo from public.flash_codes fc
where not exists (select 1 from flash_code_products where flash_code_id = fc.id); -- [FIX #18] huérfanos unlock sin productos

commit;
```

> ⚠️ **Regla del proyecto:** migraciones ya aplicadas NO se editan → todo va en una migración NUEVA (00019), siguiendo el patrón de 00017.
> ⚠️ **[FIX #19] Orden de despliegue obligatorio:** primero deployar el código que deja de usar flash codes en checkout (F1/F3), **después** ejecutar 00019 en Neon. Ejecutar la migración con el código viejo en vivo rompería `createOrder`.

---

## PASO 3 — SEPARACIÓN DE LÓGICA DE BACKEND

### `applyCoupon` (solo checkout)
- **API Route**: `src/app/api/coupons/apply/route.ts` (POST) — valida código contra tabla `coupons`, consume uso atómicamente, respeta `monto_minimo_compra`, fechas, `usos_maximos`, tipo.
- **Queries**: `src/lib/queries/coupons.ts` con `validateCoupon()`, `consumeCoupon()` (UPDATE atómico `WHERE usos_actuales < usos_maximos`), `getActiveCoupons()`.
- **Firma anclada**: `applyCoupon(codigo, subtotalCents, userId) → { ok, discountCents, mensaje }`.

### `resolveFlashCode` (solo catálogo/búsqueda)
- **Queries**: `src/lib/queries/flash-codes.ts` con `resolveFlashCode(code) → { code, products: [{ id, slug, title, price_especial_cents }] }`.
- Ya existe la infraestructura correcta en `catalog-search.tsx` / `catalogo/page.tsx` / `flash/[code]` — **se consolida** y se elimina el uso de flash codes en el carrito.
- **NO toca el checkout** ni la lógica de descuentos generales.

### Cambios de corte (ELIMINAR el patrón if/switch unificado)
- `src/lib/orders-neon.ts`:
  - Quitar `consume_flash_code` del flujo de checkout; solo `loyalty_code` (loyalty) y `coupon_code` (coupons).
  - **[FIX #17] Desambiguación:** si el código empieza con `FID-` → tabla `loyalty_coupons`; si no → tabla `coupons`. Nunca lookup en ambas (evita doble consumo).
  - **[FIX #11] Legacy:** ignorar silenciosamente el campo `flash_code` si llega de una pestaña vieja (no fallar).
  - **[FIX #17] No-acumulación con 3 fuentes:** al final del cálculo, aplicar **solo el mayor** de (descuento loyalty, descuento cupón, ahorro por precio flash). Regla: `total = min(subtotal_loyalty, subtotal_coupon, subtotal_flash)`. Nunca sumar.
  - **[FIX #9]** el mensaje de WhatsApp muestra el descuento que efectivamente ganó.
  - **[FIX #7] Reversión:** si la orden expira/cancela (CRON `expire-orders` o cancelación), revertir `usos_actuales` del cupón usando `order_id`.
- `src/store/cart.ts`: **[FIX #8]** eliminar `flashCode`/`discountCents()` + **bump `version: 2`** para invalidar el estado persistido con `flashCode`.
- `src/components/cart/cart-flash-code-input.tsx`: **[FIX #12]** se convierte en **campo de cupón** en `/checkout` (misma posición/UX, feedback de errores: aplicado ✓ / monto mínimo / agotado / vencido).
- `src/app/api/flash/validate/route.ts`: **[FIX #10]** eliminar (la búsqueda es server-side).
- `src/components/munay/live-codes.tsx` + `live-code-card.tsx`: **[FIX #10]** pasan a leer `coupons` (no `flash_codes`) y se renombran a `coupon-cards.tsx`/`coupon-card.tsx` ([FIX #13]).
- `src/lib/queries/coupons.ts` para `primera_compra` ([FIX #11]): `SELECT 1 FROM orders WHERE user_id = $1 AND status IN ('paid','completed')` → si existe, rechazar con mensaje claro.

---

## PASO 4 — SEPARACIÓN DE UI

### Panel Admin — DOS secciones independientes
1. **`/admin/coupons`** — "Cupones": formulario con `tipo` (general/primera_compra), `porcentaje_descuento`, `monto_minimo_compra`, fechas, usos. CRUD propio (`/api/admin/coupons/*`).
   - **[FIX #15]** Lista muestra `usos_actuales/usos_maximos`, botón de reset del contador, badge "Agotado" cuando `usos_actuales >= usos_maximos`.
2. **`/admin/flash-codes`** — "Código Flash": formulario con **selector de productos** (mini-colección) y **precio especial por producto**. Se simplifica quitando el selector de `type` y los campos `discount_percent/cents`.
3. **Menú admin:** enlaces separados "Cupones" y "Código Flash" en el archivo de navegación del admin (verificar `src/app/admin/layout.tsx` o sidebar, [FIX #16]).

### Vista Usuario
- **Cupones** → se muestran en la sección **"Cupones y Ofertas"** del catálogo ([FIX #13], renombrada desde "Ofertas Flash") como cards con código copiable y **countdown de `fecha_fin`** ([FIX #14]) reusando el patrón existente. Se aplican en el **checkout**.
- **Código Flash** → NO se lista; se usa escribiéndolo en la **barra de búsqueda del catálogo**, que distingue automáticamente si coincide con un `flash_code` (redirige/filtra) o es búsqueda normal. La infraestructura ya existe en `catalog-search.tsx`.
- **`/flash`** ([FIX #16]): redirige a `/catalogo` (los cupones ahora viven en "Cupones y Ofertas"). `/flash/[code]` se mantiene como destino de la búsqueda.
- El flujo "Ver detalles" de un producto flash conserva `?flash=CODE` para mantener el contexto y el precio especial.

---

## PASO 5 — VALIDACIÓN DE INDEPENDENCIA (checklist de salida)

1. ✅ **¿Puedo desactivar/eliminar todos los cupones sin afectar el flash?** — Sí: `coupons` y `flash_codes` son tablas separadas; el catálogo/búsqueda no lee `coupons`.
2. ✅ **¿Puedo desactivar todos los flash codes sin afectar los cupones?** — Sí: el checkout solo lee `coupons` + `loyalty_coupons`.
3. ✅ **¿Dos tablas separadas sin legacy unificada?** — Sí, tras 00019 no queda `type='discount'` en `flash_codes`, y la RPC unificada fue eliminada ([FIX #10]).
4. ✅ **¿Dos flujos admin separados?** — Sí, `/admin/coupons` y `/admin/flash-codes` sin formulario compartido.
5. ⚠️ **No-acumulación con 3 fuentes** ([FIX #17]): un producto puede tener precio flash, el usuario puede traer cupón Y loyalty code. Regla final en `createOrder`: **solo el mayor de los tres**, sin suma, calculado al final del checkout. El mensaje de WhatsApp muestra el que ganó.

---

## DESPLIEGUE Y ROLLBACK ([FIX #19] y [FIX #20])

### Orden de despliegue a producción (obligatorio)
1. **Primero:** deployar el código (F1 backend + F3 UI usuario) que deja de usar flash codes en checkout. El código nuevo debe tolerar la tabla vieja (legacy `flash_code` ignorado).
2. **Después:** ejecutar la migración 00019 en el SQL Editor de Neon.
3. Verificar: `/catalogo` con cupones, búsqueda flash, checkout con cupón, admin.

### Rollback (si algo falla en producción)
1. `git revert` del commit de la separación (el código viejo vuelve a usar `consume_flash_code`).
2. Restaurar datos: `INSERT INTO flash_codes SELECT * FROM coupons_backup;` (re-crear filas discount).
3. Re-crear columnas `discount_percent`/`discount_cents` y restaurar el enum si el revert lo requiere.

---

## ORDEN DE IMPLEMENTACIÓN (fases ejecutables)

1. **F0 — Migración 00019** (esquema + datos + backup): crear `coupons`, migrar discount→coupons, refactor `flash_codes` a solo unlock + `precio_especial_cents` en `flash_code_products`, drop RPC. Reporte de filas migradas y huérfanos. **(NO ejecutar en Neon hasta después de F3)**
2. **F1 — Backend**: `lib/queries/coupons.ts` + `api/coupons/apply` + `api/admin/coupons/*`; refactor `orders-neon.ts` (solo coupons/loyalty, desambiguación `FID-`, no-acumulación 3 fuentes, reversión por `order_id`); crear `lib/queries/flash-codes.ts` (`resolveFlashCode`); eliminar `consume_flash_code` del checkout y `api/flash/validate`.
3. **F2 — UI admin**: `/admin/coupons` nueva (con gestión de usos [FIX #15]); simplificar `/admin/flash-codes` (quitar type discount); menú separado.
4. **F3 — UI usuario**: `cart-flash-code-input.tsx` → campo de cupón en `/checkout` (feedback); bump `version: 2` del store; `live-codes` → `coupon-cards` leyendo `coupons`; renombrar sección "Cupones y Ofertas"; `/flash` → redirige a catálogo. **Luego: ejecutar 00019 en Neon.**
5. **F4 — Validación**: typecheck, revisores, checklist PASO 5, deploy.

---

## ENTREGABLES
1. ✅ Reporte de auditoría (PASO 1 arriba).
2. Migración 00019 (SQL + reporte de filas migradas y huérfanos).
3. `applyCoupon` y `resolveFlashCode` con código y firmas ancladas.
4. Dos interfaces admin separadas (descripción + URLs).
5. Checklist PASO 5 respondido punto por punto tras la implementación.
