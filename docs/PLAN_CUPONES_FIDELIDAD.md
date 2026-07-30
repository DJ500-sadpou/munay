# Plan: Sistema de Cupones de Fidelidad (Post-Compra)

## Objetivo
Generar un cupón de descuento automático para clientes registrados (con user_id en Clerk) después de cada compra pagada, para incentivar la recompra.

---

## 1. Arquitectura

### 1.1 Tabla SQL `loyalty_coupons`

```sql
create table if not exists public.loyalty_coupons (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.users(id) on delete cascade,
  order_id      uuid not null references public.orders(id) on delete cascade,
  code          text not null unique,  -- ej: FID-ABCD1234
  discount_percent integer not null check (discount_percent between 1 and 100),
  expires_at    timestamptz not null,
  used_at       timestamptz,           -- null = no usado aún
  created_at    timestamptz not null default now(),
  unique(user_id, order_id)  -- 1 cupón por orden por usuario
);
create index if not exists idx_loyalty_coupons_user on public.loyalty_coupons(user_id, used_at);
create index if not exists idx_loyalty_coupons_code on public.loyalty_coupons(code);
```

### 1.2 Constante toggle `LOYALTY_COUPONS`

En `src/lib/constants.ts`:
```ts
export const LOYALTY_COUPONS = {
  ENABLED: true,  // ← toggle ON/OFF desde /admin
  DISCOUNT_PERCENT: 25,  // 20-30% configurable
  EXPIRY_DAYS: 7,
  CODE_PREFIX: 'FID-',
} as const
```

Desde `/admin` se podrá cambiar `ENABLED` y `DISCOUNT_PERCENT`.

### 1.3 Admin toggle

En `/admin/page.tsx` se agregará una sección "Cupones de fidelidad" con:
- Switch ON/OFF
- Input para porcentaje de descuento (20-30%)
- Stats: cupones generados, usados, tasa de uso
- API endpoint `PUT /api/admin/loyalty-config` para persistir la configuración

---

## 2. Flujo de generación

```
markOrderPaid() exitoso
        │
        ├── award_points() (existente)
        │
        └── if LOYALTY_COUPONS.ENABLED y order.user_id existe:
              ├── Generar código único: FID-XXXXXXXX
              ├── INSERT en loyalty_coupons
              └── (Opcional) incluir en email de confirmación
```

Se implementará **dentro de `markOrderPaid`** en `orders-neon.ts`, después de `award_points` y del email de confirmación, para que sea fire-and-forget y no bloquee.

---

## 3. Flujo de uso (checkout)

En el checkout, después de que el usuario inicie sesión:
1. Query a `loyalty_coupons WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()`
2. Si hay cupones activos, mostrar en el resumen de orden
3. Al hacer submit, incluir `loyalty_code` en el body de `/api/orders`
4. En `createOrder`, si hay `loyalty_code`:
   - Validar que pertenece al user_id
   - SELECT FOR UPDATE + marcar `used_at = now()`
   - Aplicar `discount_percent` al subtotal

---

## 4. UI para el usuario

### En `/cuenta`:
```tsx
// Sección "Mis cupones de fidelidad"
// Muestra:
// - Cupones activos (no usados, no vencidos)
// - Cupones vencidos/usados (histórico)
// - Botón "Usar ahora" → redirige a /catalogo
```

### En `/checkout`:
```tsx
// Componente LoyaltyCouponSelector (similar a PointsRedeemer)
// - Si hay cupones activos, muestra selector
// - Al seleccionar, muestra descuento en el resumen
```

---

## 5. Impacto en archivos

| Archivo | Cambio |
|:---|---:|
| `supabase/migrations/00009_loyalty_coupons.sql` | **NUEVO** — tabla loyalty_coupons |
| `src/lib/constants.ts` | **EDIT** — agregar LOYALTY_COUPONS config |
| `src/lib/orders-neon.ts` | **EDIT** — generar cupón en markOrderPaid |
| `src/app/api/orders/route.ts` | **EDIT** — aceptar loyalty_code |
| `src/app/checkout/page.tsx` | **EDIT** — selector de cupón en resumen |
| `src/app/cuenta/page.tsx` | **EDIT** — mostrar cupones activos |
| `src/app/admin/page.tsx` | **EDIT** — toggle + config |
| `src/app/api/admin/loyalty-config/route.ts` | **NUEVO** — API para config |

---

## 6. Seguridad

- 1 cupón por orden (unique user_id + order_id)
- Expiración en DB (check `expires_at > now()`)
- FOR UPDATE al usar el cupón (evita doble uso concurrente)
- Validación server-side: solo el dueño puede usar su cupón

---

## 7. Pendientes para la implementación

1. ✅ Crear migración SQL
2. ✅ Agregar constantes toggle
3. ✅ Implementar generación en markOrderPaid
4. ✅ Crear endpoint de cupones del usuario
5. ✅ UI en checkout
6. ✅ UI en /cuenta
7. ✅ Admin toggle
8. ✅ Typecheck + tests
