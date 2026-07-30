# Plan Refinado: Sistema de Códigos Flash v2

> Basado en la revisión de 5 revisores (seguridad, UX, backend, negocio, mantenimiento).

---

## Resumen de hallazgos de los revisores

| Revisor | Área | Crítico | Hallazgo |
|:---|:---|:---:|:---|
| R1 | Seguridad | ❌ | Nuevas APIs necesitan `requireAdmin` explícito |
| R1 | Seguridad | ⚠️ | Validar `product_id` como UUID antes de insertar |
| R2 | UX | 🔴 | **No hay puente descuento → carrito** (usuario debe re-ingresar código) |
| R2 | UX | ⚠️ | Distinguir productos `active=true` (visibles) vs `active=false` (flash-only) |
| R3 | Backend | 🔴 | **`createOrder` necesita lógica de descuento por producto**, no global |
| R3 | Backend | ⚠️ | `getUnlockedProductIds` debe retornar también `discount_percent` |
| R4 | Negocio | ⚠️ | `type=discount` vs `type=unlock` pierde sentido — aclarar diferencia |
| R4 | Negocio | ⚠️ | `discount_percent` en 2 niveles es confuso — simplificar |
| R5 | Manten. | 🔴 | **Códigos existentes (MUNAY10, MUNAY25) sin `flash_code_products` rotos** |
| R5 | Manten. | ⚠️ | `CartFlashCodeInput` y store no se actualizan — inconsistencia |
| R5 | Manten. | ⚠️ | `discount_percent` en `flash_code_products` es redundante |

---

## Decisiones de diseño (refinadas según revisores)

### 1. Simplificar: Un solo nivel de descuento ❌ No a `discount_percent` en `flash_code_products`

Los revisores (R4, R5) señalaron que tener `discount_percent` en la asociación y en el código padre es redundante. **Decisión: Usar SIEMPRE el `discount_percent` del código padre.** Si un producto necesita un descuento diferente, se crea otro código flash. Esto elimina complejidad y lógica de "si NULL usa el padre".

### 2. Diferenciar tipos claramente (R4 propuesta)

| Tipo | Productos | Visibilidad normal | Visibilidad con código |
|:---|---:|:---:|:---:|
| `unlock` | `active=false` (ocultos) | ❌ No visible | ✅ Visible con descuento |
| `discount` | `active=true` (visibles) | ✅ Precio normal | ✅ Precio con descuento vía `?flash=` |

### 3. Flujo descuento → carrito (R2, R3, R5)

🔴 **Problema**: Actualmente `createOrder` descuenta globalmente sobre el subtotal. Con el nuevo modelo, el descuento debe aplicarse por producto.

**Solución**: El carrito de Zustand almacena el flash code como siempre, pero **no calcula descuento global**. En lugar de eso:
- Los botones en `/flash/[code]` auto-aplican `setFlashCode` en la store
- Al crear la orden, `createOrder` consulta `flash_code_products` para obtener el `discount_percent` del código y lo aplica al subtotal (como ahora, porque un código flash descuenta sobre los productos que están en `flash_code_products`)
- El `CartFlashCodeInput` en checkout se mantiene pero redirige a `/flash/[code]` si es tipo `unlock` (producto oculto) o aplica descuento si es `discount`

**Simplificación**: El descuento flash sigue siendo GLOBAL sobre el subtotal de los productos asociados al código. No hay descuento "por producto individual" — eso es sobreingeniería. El `discount_percent` del código se aplica a todos los productos en `flash_code_products`.

### 4. Migración de códigos existentes (R5)

Los códigos `MUNAY10`, `MUNAY25` (type=discount) no tienen filas en `flash_code_products`. Después del cambio:
- `type=discount`: Si no tiene productos asociados, se muestra mensaje "Este código no tiene productos asociados aún"
- Se agregará seed data: MUNAY10 y MUNAY25 asociados a productos existentes
- `SECRETO` (unlock) ya tiene `mystery-box` asociado ✅

### 5. CartFlashCodeInput se mantiene (R5)

El componente `CartFlashCodeInput` sigue funcionando:
- `type=discount`: descuenta sobre el carrito como antes (sin cambios)
- `type=unlock`: redirige a `/flash/[code]` para ver los productos ocultos
- La store Zustand se queda igual — `discountCents()` solo se calcula para type=discount

---

## Plan de implementación final

### Fase 1: API para gestionar productos asociados (NUEVO)
- `GET /api/flash-codes/[code]/products` — lista productos asociados + catálogo completo para selector
- `POST /api/flash-codes/[code]/products` — asocia producto (body: `{ product_id }`)
- `DELETE /api/flash-codes/[code]/products/[productId]` — desasocia
- Todas protegidas con `requireAdmin`
- Validación: `product_id` UUID válido + producto existe + código existe

### Fase 2: UI admin — Productos asociados (MEJORA)
- Nuevo componente `FlashCodeProductsManager` dentro de la página de edición de flash code
- Selector de productos con búsqueda, muestra: nombre, slug, precio, stock, activo/oculto
- Lista de productos asociados con botón "Desasociar"
- Mensaje claro: "Este código da **X%** de descuento a todos los productos asociados"

### Fase 3: Unificar flujo público (MEJORA)
- `/flash/[code]` unificado: AMBOS tipos buscan productos en `flash_code_products`
- `type=unlock`: trae productos `active=false` + descuento
- `type=discount`: trae productos `active=true` + descuento
- Cada producto muestra: precio original tachado, precio con descuento
- Botón "Agregar al carrito con descuento" que auto-aplica `setFlashCode` + agrega producto

### Fase 4: Catálogo con descuento condicional (MEJORA)
- En `listProducts`, si `?flash=CODE` está activo Y el código es type=discount:
  - Productos en `flash_code_products` del código muestran precio con descuento
- Si el código es type=unlock: no afecta el catálogo (solo se ve en `/flash/[code]`)

### Fase 5: Seed data actualizada
- MUNAY10 asociado a productos activos (10% desc.)
- MUNAY25 asociado a productos activos (25% desc.)
- SECRETO se mantiene asociado a mystery-box

---

## Archivos a modificar

### Nuevos
| Archivo | Propósito |
|:---|---|
| `src/app/api/flash-codes/[code]/products/route.ts` | CRUD productos asociados |
| `src/components/admin/flash-codes/flash-code-products.tsx` | UI admin para gestionar asociaciones |

### Modificados
| Archivo | Cambio |
|:---|---|
| `src/app/admin/flash-codes/[id]/page.tsx` | Integrar `<FlashCodeProductsManager>` |
| `src/app/flash/[code]/page.tsx` | Unificar flujo: ambos tipos buscan en `flash_code_products` |
| `src/lib/queries/products-neon.ts` | `getUnlockedProductIds` → `getFlashCodeProducts` (incluye discount_percent del código padre) |
| `src/app/catalogo/page.tsx` | Mostrar descuento flash solo para type=discount con `?flash=` |
| `src/components/product/product-card.tsx` | Soporte para descuento flash condicional |
| `src/components/cart/cart-flash-code-input.tsx` | type=unlock redirige a `/flash/[code]` |
| `supabase/migrations/neon_schema.sql` | Seed data actualizado (MUNAY10, MUNAY25 → flash_code_products) |
