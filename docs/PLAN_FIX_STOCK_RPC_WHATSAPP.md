# Plan de Corrección — "Error al enviar el pedido: stock insuficiente para producto"

> Estado: **PROPUESTO** — pendiente de aprobación por 5 revisores.
> Alcance: fix del flujo de envío de pedido por WhatsApp (`POST /api/checkout/whatsapp` → `createOrder`).

---

## 1. FASE 0 — Auditoría y diagnóstico (completada)

### 1.1 Síntoma reportado
Al intentar hacer un pedido en checkout aparece:
> "Error al enviar el pedido — Stock insuficiente para producto {uuid}"

El ticket NO se crea, NO se reserva stock y NO se redirige a WhatsApp.

### 1.2 Evidencia de diagnóstico

**a) Mensaje exacto → ubicación del fallo.**
El mensaje `Stock insuficiente para producto ${item.product_id}` se genera ÚNICAMENTE en
`src/lib/orders-neon.ts` línea ~531 (paso `5f. reserve_inventory`), dentro de la transacción
de `createOrder`. La pre-validación (línea ~223) usa un mensaje distinto
(`Stock insuficiente para "titulo". Disponible: N`). Como el usuario ve el mensaje de la
línea 531, el fallo ocurre SIEMPRE en `reserve_inventory`, incluso cuando hay stock.

**b) Causa raíz — parsing incorrecto del RPC jsonb (CONFIRMADO empíricamente).**

```sql
-- SELECT * FROM <fn que retorna jsonb> NO devuelve el jsonb plano:
SELECT * FROM jsonb_build_object('ok', true, 'stock', 5);
-- Resultado: [{"jsonb_build_object": {"ok": true, "stock": 5}}]
--            └── el jsonb queda ANIDADO bajo una columna nombrada como la función
```

Verificado contra la BD Neon real:
```
ROW_SHAPE: [{"jsonb_build_object":{"ok":true,"stock":5}}]
ROW0_KEYS: [ 'jsonb_build_object' ]
```

El código de `orders-neon.ts` hace:
```ts
const reserveRows = await tx`SELECT * FROM reserve_inventory(${item.product_id}, ${item.qty})`
const rr = reserveRows[0] as any
if (!rr?.ok) {   // ← rr.ok es UNDEFINED (el objeto real está en rr.reserve_inventory)
  throw { type: 'insufficient_stock', message: `Stock insuficiente para producto ${item.product_id}` }
}
```

`rr.ok` es siempre `undefined` → `!rr?.ok` es siempre `true` → **TODA orden lanza
"Stock insuficiente" sin importar el stock real**. Confirmado: la BD tiene 6 productos
con stock > 0 y `reserved = 0`; no existe ninguna razón real de stock insuficiente.

**c) Mismo bug latente en otros RPC del mismo archivo:**

| Línea | RPC | Impacto |
|---|---|---|
| ~284 | `redeem_points` | Redención de puntos SIEMPRE falla ("Redención inválida") |
| ~526 | `reserve_inventory` | **EL BUG REPORTADO** — toda orden falla |
| ~658 | `commit_inventory` | Resultado ignorado (no chequea) — sin impacto funcional, se corrige por consistencia |
| ~664 | `award_points` | Acreditación de puntos SIEMPRE reporta fallo (silencioso, solo warning) |

**d) Estado de la BD (Neon):** funciones `reserve_inventory`, `commit_inventory`,
`release_inventory`, `redeem_points`, `award_points` → todas instaladas. Inventario 6/6
con stock. 0 órdenes, 0 tickets (nada pudo completarse por el bug).

### 1.3 Archivos involucrados
- `src/lib/orders-neon.ts` — parsing de resultados de RPC (fix principal).
- `src/app/api/checkout/whatsapp/route.ts` — consumidor de `createOrder` (sin cambios funcionales; verificar mensajes).
- `src/app/checkout/page.tsx` — UI (sin cambios; el mensaje de error ya se muestra bien).

### 1.4 Qué YA funciona
- Rate limiter (3 intentos/min, 429 con countdown real).
- Guard anti doble-submit en el checkout.
- Creación de orden/ticket dentro del flujo (compensación con `markOrderCancelled` si el ticket falla).
- Mensaje de WhatsApp prearmado con ticket #XXXX y productos con precio autoritativo.
- No-acumulación flash/cupón/fidelidad.

### 1.5 Qué está ROTO
- Toda creación de orden falla por el parsing incorrecto del RPC `reserve_inventory`.
- (Latente) Redención y acreditación de puntos.

---

## 2. FASE P — Plan de corrección

### P1. Fix principal: alias explícito + lectura correcta del RPC result
**Archivo:** `src/lib/orders-neon.ts`

Reemplazar las 5 invocaciones `SELECT * FROM <rpc>(...)` (reserve_inventory,
redeem_points, award_points, commit_inventory y release_inventory) por la forma
aliasada `SELECT <rpc>(...) AS result` y leer `rows[0]?.result`:

1. **`reserve_inventory` (~526)** — el fix crítico:
   ```ts
   const reserveRows = await tx`SELECT reserve_inventory(${item.product_id}, ${item.qty}) AS result`
   const rr = reserveRows[0]?.result as any
   if (!rr?.ok) {
     // Mapear reason real ('insufficient_stock' | 'no_inventory' | 'invalid_qty')
     // con mensaje claro + available real si viene.
     throw { type: 'insufficient_stock', message: buildStockError(item, rr) }
   }
   ```
   - `reason === 'no_inventory'` → "El producto no tiene inventario registrado. Contacta a soporte."
   - `reason === 'insufficient_stock'` → "Stock insuficiente para 'X'. Disponible: N"
   - fallback → mensaje actual.

2. **`redeem_points` (~284)**:
   ```ts
   const redeemRows = await tx`SELECT redeem_points(${input.user_id}, ${input.points_to_redeem}, ${orderId}) AS result`
   const rr = redeemRows[0]?.result as any
   ```

3. **`award_points` (~664)**:
   ```ts
   const awardResult = await tx`SELECT award_points(${orderId}) AS result`
   const ar = awardResult[0]?.result as any
   ```

4. **`commit_inventory` (~658)**: mismo alias (resultado se sigue ignorando; consistencia).

5. **`release_inventory` (markOrderCancelled)**: mismo alias (resultado se sigue
   ignorando; best-effort, consistencia).

**Por qué alias `AS result` en vez de leer `rows[0].reserve_inventory`:**
- No depende del nombre de la función (si se renombra, sigue funcionando).
- Evita el footgun de la columna anidada con el nombre de la función.
- Explícito y a prueba de futuros RPC.

### P2. Mejorar mensaje de error de stock con razón real
**Archivo:** `src/lib/orders-neon.ts`
- Usar `rr.reason` y `rr.available` del RPC para dar un mensaje preciso (hoy el usuario
  ve solo "Stock insuficiente para producto {uuid}", sin el título ni el disponible).
- Mantener el mismo `error_code: 'insufficient_stock'` (el checkout/UI no cambia).

### P3. Guarda de consistencia: pre-validación vs RPC
- La pre-validación (~223) ya calcula `available` correctamente y da buen mensaje.
- Se mantiene como primera barrera (rápida, sin transacción); `reserve_inventory` queda
  como autoritativo dentro de la transacción (TOCTOU-safe). Sin cambios.

### P4. Validación
1. `npx tsc --noEmit` — debe quedar en 0.
2. `npx eslint` sobre los archivos tocados.
3. **Smoke test REAL contra Neon (no destructivo):** script que dentro de una
   transacción llama `SELECT reserve_inventory(product_id, 1) AS result` para un
   producto real y hace ROLLBACK → verifica `result.ok === true` sin mutar nada.
4. `next build` — producción.
5. E2E Playwright completo.

### P5. Regresión funcional (manual / script)
- Enviar pedido con 1 producto con stock → debe crear orden + ticket + devolver
  `whatsapp_url`.
- Producto sin stock (qty > available) → 422 con mensaje claro y SIN ticket huérfano.
- No se modifica la UI del checkout (el mensaje de error ya se muestra).

---

## 3. Criterios de aceptación
1. Un pedido con stock disponible crea la orden, reserva stock, crea ticket y devuelve
   `whatsapp_url` (sin "Stock insuficiente" espurio).
2. La redención de puntos funciona (verificar `redeem_points` con sesión).
3. `award_points` no reporta warning falso (verificable en logs de `markOrderPaid`).
4. `tsc`, `lint`, `build` y e2e pasan.
5. Ningún cambio de contrato de API (`/api/checkout/whatsapp` responde igual).

## 4. Archivos a modificar (final)
- `src/lib/orders-neon.ts` (único archivo con cambios funcionales)
- `docs/PLAN_FIX_STOCK_RPC_WHATSAPP.md` (este plan)

## 5. Riesgos
- Bajo: cambio quirúrgico de parsing, sin tocar lógica de negocio ni SQL.
- La pre-validación y el RPC pueden divergir en carrera (TOCTOU) → se mantiene el RPC
  como autoritativo (comportamiento deseado, no se cambia).
