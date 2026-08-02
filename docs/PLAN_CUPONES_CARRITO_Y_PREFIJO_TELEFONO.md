# Plan — Cupones en el carrito + Prefijo +593 en checkout

> Estado: **PROPUESTO** — pendiente de revisión con 5 revisores.
> Alcance: iteración UX sobre trabajo ya entregado (P0a–P2 + auditorías).
> Regla: NO se implementa nada hasta aprobar este plan.

---

## 1. FASE 0 — Auditoría y diagnóstico (reporte)

### 1.1 Archivos involucrados

| Archivo | Rol |
|---|---|
| `src/app/carrito/page.tsx` | Página `/carrito` — NO tiene función de cupones |
| `src/app/checkout/page.tsx` | Checkout — tiene `CouponCheckoutInput` + "Explorar mis cupones" + auto-apply `?coupon=` / `readSelected()` |
| `src/components/cart/coupon-checkout-input.tsx` | Campo "¿Tienes un cupón?" con validación contra `/api/coupons/apply` |
| `src/lib/coupon-storage.ts` | Almacenamiento compartido del "preferido" (`SELECTED_KEY`, TTL 1h) |
| `src/app/api/coupons/apply/route.ts` | POST validación de cupón (preview, NO consume). **Rate limit 10s/IP** |
| `src/lib/orders-neon.ts` | `createOrder` — revalida y consume el cupón de forma autoritativa |
| `src/app/api/checkout/whatsapp/route.ts` | Crea orden + ticket + URL WhatsApp |

### 1.2 Qué ya funciona

- Checkout: aplicar cupón manual, explorar mis cupones, handshake `/cupones` → `/checkout?coupon=X`, auto-apply del preferido con TTL, no-acumulación flash/cupón/FID- visible.
- `/cupones`: cards, agregar, términos, "Usar cupón" → `returnTo?coupon=CODE`.
- Server: `createOrder` aplica `max(flash, cupón, FID-)` y consume el cupón en transacción.

### 1.3 Qué falta (lo que pide el usuario)

1. **Carrito sin cupones**: un cliente que revisa el carrito no puede aplicar su cupón ahí; solo descubre la función al llegar al checkout → confusión ("no puedo aplicar el cupón"). Se pide la MISMA función en las 2 partes (carrito + checkout), sin romper el flujo existente.
2. **Prefijo +593**: el campo teléfono del checkout muestra `placeholder="+593 ..."` pero arranca vacío. Se pide que `+593` ya venga escrito (prefijo precargado) para ahorrar tipeo, manteniendo la posibilidad de borrarlo.

### 1.4 Causa raíz / riesgos detectados (importante)

- **Riesgo R1 (429 por doble validación)**: `/api/coupons/apply` tiene rate limit de **10s por IP**. Si el carrito valida el cupón al aplicarlo (1º request) y luego el checkout re-valida al montar (2º request en el mismo flujo), el 2º recibe 429 y el cupón NO aparece aplicado en el checkout. **Mitigación**: persistir el cupón YA VALIDADO (código + `discount_percent`) en localStorage al aplicarlo en el carrito; el checkout lo lee y lo muestra SIN re-validar (el descuento es preview; `createOrder` re-valida y consume server-side, por lo que no hay riesgo de abuso).
- **Riesgo R2 (drift de regla TTL)**: ya resuelto en el proyecto con `coupon-storage.ts` compartido. El nuevo storage del "aplicado" debe vivir en el mismo módulo para no duplicar la regla.
- **Riesgo R3 (prefill +593 como string fijo)**: si se precarga `"+593 "` como valor inicial, el usuario puede borrarlo (requisito). Pero si borra TODO y deja vacío, el campo queda vacío (aceptable, es opcional). El server guarda `phone` tal cual (no lo normaliza para wa.me del cliente; solo lo usa para contacto del admin).

### 1.5 Tablas de Neon usadas

- `coupons` (validación/consumo — no se toca en esta iteración).
- `orders`, `tickets`, `inventory` (flujo existente — no se toca).

### 1.6 Plan de corrección por prioridad

- **P1**: Cupones en el carrito (misma función que checkout) + persistencia del "aplicado".
- **P2**: Prefijo `+593` precargado y editable en el checkout.

---

## 2. P1 — Función de cupones en el carrito

### 2.1 Objetivo

En `/carrito` el usuario debe poder:
1. Aplicar un cupón escribiendo el código (validación server-side, preview de descuento).
2. Ver "Explorar mis cupones" → `/cupones?returnTo=/carrito`.
3. Al continuar al checkout, el cupón aplicado DEBE estar aplicado (sin 429, sin re-tipear).

### 2.2 Cambios de código

**A. `src/lib/coupon-storage.ts`** — agregar storage del "aplicado":

```ts
// Cupón YA VALIDADO en el carrito/checkout (preview). Key separada del "preferido".
export const APPLIED_KEY = 'munay.cupones.applied'

export interface AppliedCouponPayload {
  codigo: string
  discount_percent: number
}

export function readApplied(): AppliedCouponPayload | null { ... }
export function writeApplied(payload: AppliedCouponPayload | null) { ... }
```

- Contrato: `{ codigo, discount_percent }` (lo que devuelve `/api/coupons/apply`).
- `readApplied` valida shape (objeto con `codigo` string y `discount_percent` number) y limpia entradas corruptas.
- **Sin TTL**: el "aplicado" representa intención ACTUAL del carrito; se limpia al quitar el cupón o al aplicarse en el checkout (a diferencia del "preferido" que sí tiene TTL). Documentar la diferencia.

**B. `src/app/carrito/page.tsx`**:

1. Estado local:
   ```ts
   const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
   const [couponError, setCouponError] = useState<string | null>(null)
   ```
2. **Auto-apply al montar** (igual patrón que checkout, con guard de StrictMode):
   - Si `?coupon=` en URL → validar contra `/api/coupons/apply` → aplicar + limpiar param + `writeApplied(...)`.
   - Si no, leer `readApplied()` → aplicar directo (sin re-validar, evita 429).
   - Limpiar `?coupon=` de la URL con `history.replaceState`.
3. **`handleCouponChange`** (onChange del `CouponCheckoutInput`):
   - `setCoupon(c)` + `setCouponError(null)` + `writeApplied(c)` (null → borra).
4. **En el resumen** (Card "Resumen"), entre el separador del total y el botón "Continuar al checkout":
   - `<CouponCheckoutInput subtotalCents={subtotalCents} value={coupon} onChange={handleCouponChange} />`
   - Botón secundario "Explorar mis cupones" → `/cupones?returnTo=/carrito`.
   - Mostrar la línea "Descuento −$X" cuando el cupón gana la no-acumulación (mismo cálculo que checkout: `regularSubtotalCents`, `flashSavingsCents`, ganador). Reutilizar la misma aritmética para que el total del carrito coincida con el checkout.
   - Error de auto-apply (cupón inválido/vencido) visible con `couponError`.

5. La línea de "Descuento" y el Total deben recalcularse con el cupón (mismo algoritmo de no-acumulación que checkout):
   ```ts
   const regularSubtotalCents = lines.reduce((s, l) => s + (l.regular_unit_price_cents ?? l.unit_price_cents) * l.qty, 0)
   const flashSavingsCents = Math.max(0, regularSubtotalCents - subtotalCents)
   const couponDiscountCents = coupon ? Math.min(regularSubtotalCents, Math.round(regularSubtotalCents * (coupon.discount_percent / 100))) : 0
   // ganador: flash vs cupón (sin FID-/puntos en carrito)
   const couponWins = couponDiscountCents > 0 && couponDiscountCents > flashSavingsCents
   const promoDiscountCents = couponWins ? couponDiscountCents : 0
   const baseSubtotalCents = couponWins ? regularSubtotalCents : subtotalCents
   const adjustedTotalCents = Math.max(0, baseSubtotalCents - promoDiscountCents)
   ```

**C. `src/app/checkout/page.tsx`** — pequeña integración (para cerrar el loop):
- En el auto-apply al montar: si llega `?coupon=` y valida OK → además `writeApplied({ codigo, discount_percent })` (para que si el usuario vuelve al carrito, siga aplicado).
- En `handleCouponChange` del checkout: también `writeApplied(c)` (null → borra) — así quitar el cupón en checkout lo limpia del carrito también.
- En el submit exitoso (después de crear la orden): `writeApplied(null)` — el cupón ya se consumió, no debe re-aplicarse.

**D. No tocar**: `/api/coupons/apply`, `createOrder`, `coupon-checkout-input.tsx` (componente reutilizable tal cual).

### 2.3 Criterios de aceptación (P1)

- En `/carrito` aparece "¿Tienes un cupón de descuento?" + botón "Explorar mis cupones".
- Aplicar un cupón válido en el carrito muestra el descuento en el resumen y recalcula el total.
- Cupón inválido/vencido/monto mínimo muestra el mensaje de error del endpoint.
- Al continuar al checkout, el cupón ya está aplicado (sin 429 ni re-tipeo).
- Quitar el cupón en checkout lo quita también del carrito (y viceversa).
- No rompe la no-acumulación flash/cupón (mismo cálculo que checkout).

---

## 3. P2 — Prefijo +593 precargado y editable

### 3.1 Cambio

En `src/app/checkout/page.tsx`:

```ts
// Antes
const [phone, setPhone] = useState('')
// Después
const [phone, setPhone] = useState('+593 ')
```

- El campo arranca con `+593 ` ya escrito → el cliente solo teclea el número.
- Sigue siendo un input libre: el usuario puede borrarlo todo (ej. si es de otro país o no quiere dar el teléfono — el campo es opcional).
- Placeholder pasa a ser ejemplo del resto: `"9X XXX XXXX"` (solo visible si borra todo).
- Sin lógica forzada de re-agregar el prefijo al hacer blur (se respeta la decisión del usuario de borrarlo).
- El server guarda `phone` tal cual (contacto del admin); no se normaliza ni valida formato.

### 3.2 Criterios de aceptación (P2)

- Al abrir `/checkout`, el campo "Teléfono / WhatsApp" muestra `+593 ` precargado.
- El usuario puede agregar el número sin teclear el país.
- El usuario puede borrar el prefijo por completo (campo queda libre/vacío).
- No hay validación que fuerce a mantener el prefijo.

---

## 3.5 Correcciones incorporadas (Ronda Plan R1–R5)

Los 5 revisores confirmaron el diagnóstico y aportaron correcciones que YA están
incorporadas en el diseño:

1. **Gap crítico (R4)**: el checkout debe LEER `readApplied()` como 3ª fuente en su
auto-apply (tras `?coupon=` y `readSelected()`) — sin eso el cupón aplicado en el
carrito no llegaría a checkout (criterio de aceptación P1 roto). Implementado con
re-validación tolerante a 429: si `/api/coupons/apply` responde `rate_limited` por
el request del carrito, se usa el payload almacenado sin re-validar.
2. **Anti-drift (R2/R4)**: la aritmética de no-acumulación se extrajo a un helper
compartido `src/lib/coupon-math.ts` (`computePromo`) usado por carrito Y checkout
— el proyecto ya centralizó `coupon-storage.ts` por drift; el preview del carrito
y del checkout ahora coinciden EXACTO entre sí y con `createOrder`.
3. **Precedencia y limpieza (R2/R4)**: `?coupon=` gana sobre `readApplied()` sobre
`readSelected()`. `writeApplied(null)` se ejecuta en: quitar cupón (ambas páginas),
botón "Vaciar" del carrito, y tras crear la orden en el checkout (el cupón se
consumió en createOrder).
4. **Stale preview (R2)**: `readApplied()` sin TTL puede mostrar un cupón vencido;
se acepta porque es SOLO preview y `createOrder` revalida/consume server-side (el
error 422 aparece al confirmar, nunca un total incorrecto final). Documentado en
el módulo.
5. **Rules-of-hooks (R1)**: los `useState`/`useEffect` de cupón en el carrito se
declaran ANTES de los early returns (skeleton / carrito vacío).
6. **UX mobile (R3)**: el input de teléfono pasa a `type="tel"` + `inputMode="tel"`
(teclado numérico; el usuario ya no teclea el prefijo).
7. **Test (R4)**: e2e nuevo que verifica que `/carrito` renderiza la sección de
cupones y que `/checkout` precarga `+593 `.

---

## 4. Validación y deploy

1. `tsc --noEmit` (exit code real).
2. ESLint de los archivos tocados.
3. `next build`.
4. E2E Playwright (suite completa) — verificar que no se rompan los 12 tests.
5. Smoke test manual del flujo: aplicar cupón en carrito → checkout lo muestra aplicado.
6. Deploy (commit + push a master, Vercel auto-deploy).
