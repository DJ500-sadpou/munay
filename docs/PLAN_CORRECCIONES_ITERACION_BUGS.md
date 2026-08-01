# Plan de Corrección — Búsqueda · WhatsApp/Ticket · Código Flash · Cupones

> **Estado:** PROPUESTO — pendiente de aprobación para implementar.
> **Base:** reporte de Dylan (31/7/2026) + trabajo previo F0–F4 + auditoría.
> **Regla del prompt:** NO se implementa nada hasta aprobar este plan (FASE 0 obligatoria).
> **Revisión:** cada fase se implementa y pasa por **2 rondas de 5 revisores en paralelo** (revisión → corrección de issues → re-revisión), más validación técnica y despliegue.

---

## 1. FASE 0 — Auditoría y diagnóstico

### 1.1 Archivos, componentes y rutas involucradas

| Área | Archivos |
|---|---|
| Búsqueda catálogo | `src/app/catalogo/page.tsx`, `src/components/catalogo/catalog-search.tsx`, `src/components/catalogo/catalog-filters.tsx`, `src/lib/queries/products-neon.ts` (`listProducts`, `getValidFlashCode`, `looksLikeFlashCode`), `src/components/product/product-card.tsx` |
| Envío WhatsApp / ticket | `src/app/api/checkout/whatsapp/route.ts`, `src/app/checkout/page.tsx`, `src/app/checkout/success/page.tsx`, `src/lib/orders-neon.ts` (`createOrder`, `markOrderCancelled`, `insertTicketWithRetry`), `src/lib/auth/turnstile.ts`, `src/components/auth/turnstile-widget.tsx`, `src/lib/constants.ts` (`SITE.whatsapp`) |
| Código Flash admin | `src/app/admin/flash-codes/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `src/components/admin/flash-codes/flash-code-form.tsx`, `flash-code-products.tsx`, `src/app/api/flash-codes/route.ts`, `[id]/route.ts`, `[code]/products/route.ts` |
| Cupones | `src/lib/queries/coupons.ts` (`validateCoupon`, `getActiveCouponsForUser`), `src/app/api/coupons/apply/route.ts`, `src/components/cart/coupon-checkout-input.tsx`, `src/components/cart/loyalty-coupon-checkout.tsx`, `src/components/munay/coupon-cards.tsx` |
| Naming “Cupones y ofertas” | `src/components/munay/header.tsx`, `footer.tsx`, `hero.tsx`, `coupon-cards.tsx`, `src/app/page.tsx` (section `#cupones-y-ofertas`), `src/app/flash/page.tsx` (metadata) |

### 1.2 Qué ya funciona (verificado en auditoría previa)

- Catálogo sin búsqueda: 200 en producción (stress 40×200), agrupación nuevo/usado OK, empty state simple ya existe.
- `createOrder` con no-acumulación de 3 competidores (flash / cupón / FID-) recalcula precios server-side y consume cupón atómicamente dentro de transacción.
- Ticket `#XXXX` con secuencia 4 dígitos + retry anti-colisión `23505` (10 intentos) y compensación `markOrderCancelled` si el ticket falla.
- Mensaje WhatsApp prearmado con ticket, items y descuento ganador (muestra `%` flash cuando gana flash).
- Admin **ya tiene** gestor de productos por código flash (`FlashCodeProductsManager`) en la página de edición: buscar, asociar/desasociar, precio especial por producto.
- Cupón en checkout (`CouponCheckoutInput`) con validación `/api/coupons/apply` (preview, no consume) y feedback de errores.
- `requireAdmin` protege todas las rutas admin; Turnstile antes de crear orden; rate limiters presentes.

### 1.3 Qué está roto / reportado

1. **ERROR 1 — Búsqueda rompe la página**: “This page couldn't load. A server error occurred. Reload to try again.”
2. **ERROR 2 — Enviar pedido por WhatsApp**: “Demasiadas solicitudes. Intente en 10 segundos.” → no se crea ticket, no se redirige a WhatsApp.
3. **ERROR 3 — Código Flash admin**: el usuario no puede (o no encuentra cómo) seleccionar producto/mini-colección al que el código redirige.
4. **CAMBIO 4 — Renombrar** “Cupones y ofertas” → “Cupones”, y que no lleve a la landing sino a una página dedicada.
5. **MÓDULO 5 — Nueva página “Mis cupones”** (`/cupones`): cards, agregar/redimir cupón, términos, ayuda, estados vacíos.
6. **MÓDULO 6 — Cupones en checkout**: campo “Ingresa un cupón” (ya existe) + botón “Explorar mis cupones” → `/cupones?returnTo=/checkout` con “Usar cupón” que vuelve al checkout aplicado.

### 1.4 Causa raíz probable por error

| # | Síntoma | Causa raíz probable | Evidencia |
|---|---|---|---|
| 1 | Búsqueda → server error | La página catálogo es **Server Component sin try/catch** alrededor de `listProducts()` / `getValidFlashCode()`. Cualquier excepción de Neon (tabla/columna faltante en prod, `JSON.parse(r.images)` con imágenes malformadas en `user_listings`, error transitorio) propaga → Next error boundary → pantalla genérica. El path `q` dispara queries ILIKE + `looksLikeFlashCode` que no corren sin `q`. | `products-neon.ts` Líneas del ILIKE y del `JSON.parse` de P2P; `catalogo/page.tsx` sin `try/catch` en todo el fetch |
| 2 | “Demasiadas solicitudes” + sin ticket + sin redirect | Rate limiter de `/api/checkout/whatsapp` (15s por IP, en memoria) — `recordRateLimit(ip)` corre **después de Turnstile+validación pero ANTES de `createOrder`**: si `createOrder` falla (422 stock/validación) el intento ya se registró, y el reintento legítimo dentro de 15s recibe 429 → nunca llega a crear orden ni ticket. Además doble-submit posible si el usuario hace 2 clics rápidos (el botón se deshabilita por estado React, pero no hay guard por ref). `Retry-After` devuelto pero el cliente no muestra countdown. | `whatsapp/route.ts` orden: `recordRateLimit` → `createOrder`; `checkout/page.tsx` `handleSubmit` sin `useRef` guard |
| 3 | Flash code admin sin selección de productos | La UI **existe** pero solo en la página de **edición** (`[id]/page.tsx`); la página de **nuevo** (`new/page.tsx`) solo tiene el formulario. El admin crea el código y no ve el gestor hasta entrar a editar. No hay multi-selección ni concepto de “mini-colección” (hoy = N productos asociados). | `new/page.tsx` (sin `FlashCodeProductsManager`), `[id]/page.tsx` (con él) |
| 4 | Naming y destino “Cupones y ofertas” | 4 referencias `/#cupones-y-ofertas` (header, footer, hero, página) + títulos internos. El destino sigue siendo la sección de la landing. | `header.tsx` NAV_LINKS, `footer.tsx`, `hero.tsx`, `coupon-cards.tsx` |
| 5 | No existe `/cupones` | Ruta no creada. No hay endpoint para “agregar cupón” (solo `validateCoupon` de preview) ni UI de mis cupones. | — |
| 6 | Checkout sin explorar cupones | Falta botón secundario y handshake `returnTo`/`?coupon=`. El input de cupón ya existe. | `coupon-checkout-input.tsx` |

### 1.5 Datos mockeados / dependencias

- **Nada crítico mockeado** en cupones/flash/tickets: todo viene de Neon (tablas `coupons`, `flash_codes`, `flash_code_products`, `tickets`, `orders`, `coupon_usages`, `settings`).
- `SITE.whatsapp` usa env `NEXT_PUBLIC_WHATSAPP_NUMBER` con fallback `+593959756845` (correcto, var pública).
- Placeholder de imágenes: `product-card.tsx` ya renderiza `ImageOff` cuando `image_url` es null → el catálogo no rompe por imagen faltante (el crash es de query, no de render).

### 1.6 Tablas de Neon usadas

`products`, `inventory`, `product_images`, `user_listings`, `flash_codes`, `flash_code_products`, `flash_campaigns` (banner landing), `coupons`, `coupon_usages`, `loyalty_coupons`, `tickets`, `orders`, `order_items`, `settings` (00023).

### 1.7 API routes / Server Actions que intervienen

- `POST /api/checkout/whatsapp` (orden + ticket + URL wa.me) — **crítico**.
- `POST /api/coupons/apply` (validación preview, no consume) — **crítico** para M5/M6.
- `GET|POST /api/flash-codes`, `PUT|DELETE /api/flash-codes/[id]`, `GET|POST|DELETE /api/flash-codes/[code]/products`.
- `GET /api/cron/expire-orders` (cron Vercel, respeta `auto_expire_tickets_enabled`).
- Server Components: `catalogo/page.tsx` (queries directas), `admin/flash-codes/[id]/page.tsx` (`queryOne` directo), landing (`getActiveCouponsForUser`).

---

## 2. Plan de corrección por prioridad

### FASE P0a — ERROR 1: Búsqueda del catálogo no debe romper la página

**Objetivo:** ningún input (vacío, especial, sin resultados, error Neon) tira la página; loading y empty state elegantes.

1. Envolver en `catalogo/page.tsx` todo el fetch (`listProducts`, `getValidFlashCode`, `getUnlockedProducts`) en `try/catch` con estado de error amigable:
   - Mostrar: “No pudimos realizar la búsqueda. Inténtalo nuevamente.” + botón reintentar (`router.refresh()` o re-cargar con `?q=`).
   - **Nunca** exponer stack traces ni errores internos.
2. En `products-neon.ts`:
   - `JSON.parse(r.images)` → `safeParseImages()` (try/catch → `[]`).
   - Normalizar `r` antes de mapear (valores `null` tolerados: `Number(null)` → 0 con guard, `grading` inválido → `null`).
   - `getValidFlashCode` y `listProducts`: try/catch interno que devuelva `[]`/`null` (no throw) ante errores transitorios, log `console.warn`.
3. Empty state dedicado (ya existe parcialmente) → ajustar textos al prompt:
   - Título: “No encontramos resultados” · Texto: “Prueba con otra prenda, marca o categoría.” · Botón: “Limpiar búsqueda” (vuelve a `/catalogo`).
4. Loading state: la página es Server Component → envolver la grilla en `<Suspense>` con skeleton (patrón ya usado en la landing con `CampaignBannerSkeleton`).
5. Validar que caracteres especiales (`%`, `_`, comillas, `&`) no rompan: ya son parámetros (`$1`), no concatenación — solo confirmar en tests.
6. Confirmar la causa raíz exacta con **logs de Vercel** (buscar el `Error` real del 500) antes de cerrar la fase; si es tabla/columna faltante en prod, correr la migración faltante.

**Criterio de aceptación:** buscar “chaqueta”, “pantalón”, texto inexistente, vacío y caracteres especiales no rompe la página; hay loading y empty state; sin error genérico de Next.js.

### FASE P0b — ERROR 2: Enviar pedido por WhatsApp debe crear ticket y redirigir

**Objetivo:** 1 clic = 1 ticket; sin 429 en flujo normal; si falla, no abrir WhatsApp con datos incompletos.

1. **Rate limiter justo (mantener anti-abuso):**
   - **PRIMARIA — ventana deslizante que registra intentos con más holgura (ej. 3 intentos por minuto por IP)** en lugar de 1 por 15s, manteniendo `recordRateLimit` ANTES de `createOrder`. NO mover el registro a después del éxito: `createOrder` reserva stock y consume cupones/puntos en transacción, y permitir intentos ilimitados hasta el éxito abriría un vector de abuso martillando esa operación costosa.
   - Con la ventana deslizante, un 422 (stock/validación) ya no bloquea el reintento legítimo, pero el spam sigue limitado a 3/min.
   - Devolver `Retry-After` y mostrar **countdown real** en el cliente cuando el 429 sea real.
2. **Cliente `checkout/page.tsx`:**
   - Guard con `useRef` contra doble-submit (`if (submittingRef.current) return; submittingRef.current = true; … finally { … }`) además del `disabled` por estado.
   - En 429: mostrar mensaje con countdown del `Retry-After` (“Intenta en X segundos”) en vez del error genérico.
   - Mantener loading “Generando tu ticket…” (ya existe “Enviando pedido…”).
3. **Flujo ticket (ya robusto, verificar):** `insertTicketWithRetry` → si agota colisiones → `markOrderCancelled(orderId, 'ticket_creation_failed')` → 500 sin `ok:true` falso. Confirmar con test.
4. **Redirección:** `whatsapp_url` ya se construye con `wa.me/${normalizeWhatsAppNumber(...)}?text=${encodeURIComponent(...)}`. Confirmar que el checkout navega a success con `?wa=` y que la success page abre el enlace (no popup-blocked).
5. **Turnstile:** confirmar que en producción está `TURNSTILE_SECRET_KEY` configurado; si el token falla, el error debe ser claro (“Verificación anti-bot, recarga”) y no consumir rate limit (ya no se registra antes).
6. **Mensaje de WhatsApp — completar el formato mínimo del prompt** (hoy `itemsSummary` solo arma `title × qty`): por ítem debe incluir **Nombre | Talla | Cantidad | Precio** (ej. `1. Chaqueta denim | Talla: M | Cantidad: 1 | $45.00`). Los items enviados desde el checkout no llevan talla ni precio — el mensaje debe construirse con los datos que `createOrder` calculó de forma autoritativa (títulos, tallas y precios finales por ítem devueltos en `orderResult`), nunca con datos crudos del cliente. Verificar además que `total_cents` coincida con el total final del checkout (la matemática del preview ya replica a `createOrder`).

**Criterio de aceptación:** un clic genera un solo ticket; aparece en admin; stock reservado; WhatsApp abre con mensaje completo; sin 429 en flujo normal; si falla el ticket, no abre WhatsApp.

### FASE P1 — ERROR 3: Código Flash admin con productos / mini-colección

**Objetivo:** el admin selecciona los productos (o mini-colección) a los que el código redirige, con validación server-side.

1. **Verificar y pulir el gestor existente** (`FlashCodeProductsManager`):
   - En `admin/flash-codes/new/page.tsx`: tras crear el código, redirigir a `/admin/flash-codes/[code]` para asociar productos (o integrar el gestor en el mismo flujo con el código ya creado).
   - En el listado (`admin/flash-codes/page.tsx`): botón “Productos” visible por fila → edición.
2. **Multi-selección / mini-colección:** permitir seleccionar varios productos a la vez (checkbox + “Asociar seleccionados”) y agruparlos como “mini-colección” (hoy se implementa como N productos con el mismo `code` en `flash_code_products` — el modelo ya lo soporta).
3. **Validación server-side** (endpoint `[code]/products`): código activo, no vencido, no superado en usos, productos existen. Confirmar que el endpoint ya valida; si no, agregarlo.
4. **No aplicar a toda la tienda:** el filtrado por `flash_code_products` (WHERE p.id IN ...) ya lo garantiza — verificar en catálogo.
5. **Banner y vigencia en catálogo:** ya existe badge “Código Flash aplicado ⚡” + aviso con vigencia; agregar “usos restantes” si `max_uses` existe (datos ya disponibles en `getValidFlashCode.remaining_uses`).

**Criterio de aceptación:** admin crea código para 1 producto y para 2+; usuario escribe el código en buscador → se muestran solo esos productos con precio especial; no aparece como cupón en checkout.

### FASE P2a — CAMBIO 4: Renombrar a “Cupones” y apuntar a `/cupones`

1. `header.tsx` `NAV_LINKS`: `{ href: ROUTES.cupones, label: 'Cupones' }` (quitar `live` badge si aplica o mantener opcional).
2. `footer.tsx`: link “Cupones” → `/cupones`.
3. `hero.tsx`: CTA “Ver cupones” → `/cupones`.
4. `coupon-cards.tsx`: título “Cupones” (componente sigue usándose en landing como vista resumida, pero el CTA lleva a `/cupones`).
5. `app/page.tsx`: `aria-label="Cupones"` y ajustar el link si hay.
6. `flash/page.tsx`: metadata `Cupones`.
7. Agregar `cupones: '/cupones'` a `ROUTES` en `constants.ts`.

### FASE P2b — MÓDULO 5: Nueva página “Mis cupones” (`/cupones`)

**Diseño:** skills de diseño disponibles (frontend-design / high-end-visual-design / web-design-guidelines). Paleta MUNAY: fondo Crema `#F6F1E8`, cards blancas, bordes Warm Gray, CTA Terracota `#C65A2E`, confianza/éxito Turquesa `#2AA7A0`, texto Carbón/Cacao. Mobile-first.

**Servidor (`src/app/cupones/page.tsx`, Server Component):**
- `const user = await currentUser()` → `getActiveCouponsForUser(user.id, user.email)` (respeta primera_compra).
- Handshake: leer `searchParams.returnTo` (ej. `/checkout`).
- Render: header con flecha atrás + “Mis cupones” + subtítulo “Úsalos en tus compras y ahorra más.”

**Cliente (`src/components/cupones/`):**
1. **Área “Agregar cupón”**: input + botón “Agregar”. **Cuidado**: `POST /api/coupons/apply` valida con `subtotal_cents` y rechazaría con `min_amount` si el usuario no tiene carrito → para “agregar” NO debe depender del subtotal. Solución: pasar el subtotal del carrito actual (store disponible client-side; si carrito vacío, subtotal 0) y en el estado de la card marcar el cupón como “agregado” aunque no cumpla el monto mínimo, mostrando el requisito (“Monto mínimo: $20”) en vez de rechazarlo; la validación de `min_amount` se reserva para el momento de aplicar en checkout. Estados: válido agregado / ya agregado / vencido / no encontrado / no disponible / primera compra no aplicable. Guardar códigos agregados en `localStorage` (`munay.cupones.added`) para persistir “Mis cupones”.
2. **Cards de cupones** (patrón PedidosYa adaptado, sin branding):
   - `%` grande (“20% OFF”), código, descripción, badge “Primera compra”, “Compra mínima: $20” o “Sin compra mínima”, vigencia (“Vence hoy a las 23:59” / “Vence el 15 de agosto”), estado (Disponible / Próximo a vencer / Vencido).
   - Botón principal “Usar cupón” + ícono de información → modal/bottom sheet de términos (vault/radix dialog).
3. **“Usar cupón”:**
   - Si `returnTo` existe → `router.push(`${returnTo}?coupon=CODE`)`.
   - Si navegación normal → guardar como preferido en localStorage y navegar a `/checkout?coupon=CODE` (o al catálogo). Elegir la opción más coherente: **ir a checkout** si hay carrito, si no a catálogo.
   - **Estado “Aplicado” de las cards**: definir el almacenamiento — un cupón “aplicado” = el seleccionado como preferido en `localStorage` (`munay.cupones.selected`); las cards marcan “Aplicado” para ese código y “Usar cupón” lo cambia.
4. **Términos y condiciones** (modal): código, %, tipo, monto mínimo, fecha/hora exacta de vencimiento, límite de usos, regla “Los descuentos no son acumulables… Munay aplicará el mayor”.
5. **Ayuda**: “¿Cómo uso un cupón?” → acordeón/diálogo con la guía en 5 pasos del prompt.
6. **Empty state**: “Aún no tienes cupones disponibles” + “Revisa nuestras campañas, participa en MUNAY Live o agrega un código.” + CTA “Explorar catálogo”.
7. Estados de loading (skeleton) y error amigable.

### FASE P2c — MÓDULO 6: Cupones en checkout

1. **Campo “Ingresa un cupón”** (ya existe en `CouponCheckoutInput`) — mantener, mejorar microcopy.
2. **Botón secundario “Explorar mis cupones”** → `/cupones?returnTo=/checkout` (debajo del campo).
3. **Aplicación al volver:** en `checkout/page.tsx`, leer `searchParams.coupon` al montar → aplicar automáticamente llamando a `/api/coupons/apply` con el código (setear `coupon` state). Sin estado global nuevo: el query param es el transporte. **Nota Next 15**: `useSearchParams` en un componente cliente exige envolverlo en `<Suspense>` (error de build si no) — el checkout ya es cliente; validar en el build.
4. **No-acumulación visible:** ya está implementada la matemática (3 competidores en preview y server). Agregar mensaje visible cuando coexistan flash y cupón:
   - “Tu producto ya tiene descuento de Código Flash del 25%. Tu cupón ofrece 15%. Aplicamos automáticamente el mejor descuento disponible. Los descuentos no son acumulables.”
   - Si gana el cupón: “Aplicamos tu cupón del 30% porque ofrece un mejor descuento que el Código Flash activo.”
5. Confirmar que el total enviado al ticket = total final mostrado (ya cubierto por la matemática replicada; test manual lo valida).

---

## 3. Rondas de revisión (5 revisores en paralelo)

Metodología por fase (misma que F1–F4): **implementar → Ronda 1 (5 revisores paralelos) → corregir issues → Ronda 2 (5 revisores paralelos) → validar → desplegar**.

### Ronda 1 — Tras implementar cada fase (en paralelo, 5 agentes)

| Revisor | Foco |
|---|---|
| R1.1 | **Lógica de búsqueda + manejo de errores**: try/catch correcto, sin leaks de stack, empty/loading states, SQL ILIKE parametrizado, `safeParseImages`, null-safety. |
| R1.2 | **Rate limiter + flujo WhatsApp**: ¿`recordRateLimit` movido tras éxito? ¿doble-submit cubierto con ref? ¿countdown Retry-After? ¿compensación del ticket sin orden huérfana? ¿no abrir WhatsApp si falla? |
| R1.3 | **Seguridad**: validación server-side de cupones/flash (activo, vigencia, usos, monto mínimo, primera_compra con `clerk_user_id`), no confiar en precios del cliente, `requireAdmin` en todas las rutas admin nuevas, sin secrets al cliente. |
| R1.4 | **Matemática de no-acumulación**: preview checkout ↔ `createOrder` idénticos en los 7 casos (ninguno, cupón, fidelidad, flash, flash+cupón→cupón, flash+cupón→flash, puntos); total del ticket = total del checkout. |
| R1.5 | **UX/UI + accesibilidad** (skills de diseño): página `/cupones` mobile-first, paleta MUNAY, cards, modal de términos, estados vacíos/loading/error, focus y aria, coherencia visual. |

### Corrección de issues
- Consolidar hallazgos, corregir **solo bugs reales** (con archivo:línea), re-validar.

### Ronda 2 — Re-revisión (en paralelo, 5 agentes)
- Mismos 5 focos sobre la versión corregida; confirmar que los issues de Ronda 1 quedaron resueltos y no se introdujeron regresiones.

### Validación técnica (paralela a cada ronda)
- `npx tsc --noEmit` (exit 0) · `npx eslint` sobre archivos tocados (limpio) · `next build` OK.
- E2E: `npx playwright test` (10 tests; actualizar los que dependan de la landing si cambia el CTA).
- Stress: `scripts/stress-audit.mjs` (25×100 contra producción/dev con `STRESS_ALLOW_REAL_DB=1`) — verificar 0 errores 5xx, rate limiter funcionando (429 solo con IP repetida), búsqueda con `q` real.

### Despliegue
- Commit + push a `master` (Vercel auto-deploy) → verificar en producción: búsqueda, checkout→WhatsApp, `/cupones`, admin flash code con productos.

---

## 4. Tests manuales mínimos (checklist de aceptación)

1. Buscar producto existente. ✅
2. Buscar producto inexistente → empty state. ✅
3. Buscar con texto vacío → catálogo completo. ✅
4. Buscar código flash válido → solo productos asociados + badge ⚡. ✅
5. Crear ticket y abrir WhatsApp (mensaje completo, ticket #XXXX). ✅
6. Doble click en “Enviar pedido” → 1 solo ticket. ✅
7. Aplicar cupón general en checkout. ✅
8. Aplicar cupón primera compra (usuario nuevo) ✅ / (usuario que ya compró → rechazo claro) ✅.
9. Cupón menor que descuento flash → gana flash, sin acumular. ✅
10. Cupón mayor que descuento flash → gana cupón, sin acumular. ✅
11. “Explorar mis cupones” desde checkout → elegir cupón → vuelve aplicado. ✅
12. Búsqueda con `%`, `_`, `&`, acentos → no rompe. ✅
13. Admin: crear flash code → asociar 1 y 2+ productos → probar en buscador. ✅

---

## 5. Pendientes que dependen de externos

- Fotos reales de productos (hoy placeholder `ImageOff` — correcto, no bloquea).
- `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel (verificar configuradas).
- `NEXT_PUBLIC_WHATSAPP_NUMBER` real en Vercel (fallback actual `+593959756845`).
- Confirmar en logs de Vercel la causa raíz exacta del 500 de búsqueda (columna/tabla faltante vs error transitorio).
- (Opcional recomendado) Email Brevo al admin al crearse ticket — fuera de alcance de esta iteración salvo que se apruebe.
