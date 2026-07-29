# FASE 4/5 — Cuenta de usuario + Puntos + Admin completo

**Objetivo:** permitir a los clientes crearse cuenta, ver su historial de órdenes,
consultar y redimir puntos, y dar al admin herramientas completas de gestión
(flash codes, métricas avanzadas).

---

## Funcionalidades implementadas

### 1. Autenticación de usuarios finales

**Rutas:** `/cuenta/login`, `/cuenta/callback`

Doble método de autenticación con Supabase Auth:

- **Magic Link:** el usuario ingresa solo su email → recibe un enlace → al hacer clic, es redirigido a `/cuenta/callback` que intercambia el código por sesión.
- **Email + contraseña:** para usuarios que prefieren el flujo clásico. Incluye registro nuevo.
- El callback página maneja el intercambio del código con feedback visual (loading/success/error).

**Helpers de auth** (`src/lib/auth/require-user.ts`):
- `requireUser(redirectAfter?)` — exige sesión, redirige a login si no.
- `getOptionalUser()` — retorna el usuario si hay sesión, sin redirigir.
- `isUserLoggedIn()` — booleano para navbar.
- Cada uno retorna también `customer_id` y `points_balance` si existen.

### 2. Página /cuenta (dashboard del usuario)

- Stats: puntos disponibles, total de órdenes, total gastado.
- Órdenes recientes (últimas 5) con estado y link a detalle.
- Atajos a historial completo y puntos.
- Botón de cerrar sesión (POST a `/api/auth/logout?next=/cuenta/login`).

### 3. Historial de órdenes

**Rutas:** `/cuenta/ordenes`, `/cuenta/ordenes/[id]`

- Lista todas las órdenes del usuario (por `user_id` o por `customer_email` — así aparecen también las compras hechas como guest antes de crear cuenta).
- Cada item muestra: ID, fecha, cantidad de items, total, estado (pagada/pendiente/cancelada).
- Detalle completo con: items, precios, datos de envío, resumen financiero, puntos usados.

### 4. Ledger de puntos

**Ruta:** `/cuenta/puntos`

- Card principal con **saldo disponible** y equivalente en descuento.
- Stats: total ganado, total redimido.
- Reglas explicadas (1pto/$1, 10pts=$1 descuento, mínimo 10 pts para redimir).
- Historial completo de movimientos (`point_transactions`) con tipo, monto, fecha y nota.
- Iconos diferenciados: ganado (verde ↑), redimido (rojo ↓), ajuste (ámbar ✦).

### 5. Redención de puntos en checkout

**Componente:** `src/components/cart/points-redeemer.tsx`

- Aparece solo si el usuario está logueado y tiene saldo ≥ 10 pts.
- Modo colapsable para no invadir la UI.
- Opción "Usar máximo" calcula el máximo redimible (limitado por saldo Y por subtotal).
- Input personalizado que redondea al múltiplo inferior de 10.
- Validación en backend: `createOrder` verifica saldo contra `customer_point_balances`.
- Recalcula total en tiempo real y muestra descuento en el resumen.
- Tras pago confirmado, se inserta transacción `type='redeem'` con puntos negativos.

### 6. CRUD de flash codes (admin)

**Rutas:** `/admin/flash-codes`, `/admin/flash-codes/new`, `/admin/flash-codes/[id]`

- Listado con tabla: código, tipo, descuento, usos (count/max), vigencia, estado.
- Estado calculado: Vigente, Inactivo, Programado, Expirado, Agotado.
- Formulario único para crear/editar:
  - Código (auto-uppercase, solo A-Z0-9, 4-32 chars).
  - Tipo: discount o unlock.
  - Si discount: porcentaje (%) o monto fijo (USD).
  - Fechas de inicio/fin (datetime-local).
  - max_uses (vacío = ilimitado).
  - Switch activo/pausado.
- APIs: `POST /api/flash-codes`, `PUT /api/flash-codes/[id]`, `DELETE /api/flash-codes/[id]`.
- Validaciones server-side completas + verificación de admin.

### 7. Métricas avanzadas

**Ruta:** `/admin/metrics`

KPIs principales:
- **Ingresos (30 días)** — suma de `total_cents` de órdenes paid.
- **Ticket promedio** — ingresos / órdenes pagadas.
- **Clientes registrados** — count de `customers`.
- **Puntos otorgados** — suma de `point_transactions` type=earn.

Gráficos:
- **Ventas diarias (30 días)** — gráfico de barras CSS puro con tooltip hover mostrando monto y count.
- **Top productos** — tabla con unidades vendidas e ingresos generados (top 10).

### 8. Navbar con UserMenu

**Componente:** `src/components/layout/user-menu.tsx`

- Llama a `/api/user/points` al montar para detectar sesión.
- Si no logueado: botón "Ingresar".
- Si logueado: avatar con inicial + badge de puntos + dropdown con:
  - Email + saldo.
  - Links a /cuenta, /cuenta/ordenes, /cuenta/puntos.
  - Cerrar sesión (POST a /api/auth/logout).

### 9. API: GET /api/user/points

Endpoint público (sin auth requerida en el guard, pero retorna 401 si no hay sesión) que devuelve:
```json
{ "ok": true, "email": "...", "balance": 120, "customer_id": "uuid" }
```
Usado por el `UserMenu` y por el checkout para precargar el saldo.

---

## Cómo probar el flujo completo

### Setup inicial (una sola vez)

1. Configura Supabase con las 7 migraciones.
2. Crea tu usuario admin (Fase 1).
3. En Supabase Dashboard → Authentication → Providers → Email:
   - Habilita "Email" si no lo está.
   - Para dev: desactiva "Confirm email" (así el registro es inmediato).
   - Para prod: déjalo activado.
4. Crea un usuario cliente desde Authentication → Users → Add user (o deja que se registre via UI).

### Flujo de compra + puntos

1. Inicia sesión en `/cuenta/login` con tu usuario cliente.
2. Visita `/catalogo`, agrega piezas al carrito.
3. Aplica un código flash (ej: `MUNAY10`).
4. Ve a `/checkout`:
   - El selector de puntos aparecerá si tienes saldo.
   - Selecciona "Usar máximo" o ingresa una cantidad.
   - El total se recalcula en tiempo real.
5. Completa el form y paga (modo demo).
6. En `/checkout/success` verás los puntos ganados.
7. Visita `/cuenta/puntos` para ver el ledger completo.
8. Visita `/cuenta/ordenes` para ver el historial.

### Gestión de flash codes (admin)

1. Inicia sesión en `/admin/login`.
2. Ve a `/admin/flash-codes`.
3. Crea un nuevo código (ej: `VERANO20` con 20% de descuento, válido 30 días).
4. Verifícalo buscando `VERANO20` en el catálogo → te llevará a `/flash/VERANO20`.
5. Edita el código, desactívalo, etc.

### Métricas

1. Tras varias compras de prueba, visita `/admin/metrics`.
2. Verás el gráfico de ventas por día y el top de productos.

---

## Estructura de archivos nuevos en Fase 4

```
src/
├── app/
│   ├── cuenta/
│   │   ├── page.tsx                       # Dashboard del usuario
│   │   ├── login/page.tsx                # Login/registro (magic link + OTP)
│   │   ├── callback/page.tsx             # Intercambio de código magic link
│   │   ├── ordenes/page.tsx              # Historial de órdenes
│   │   ├── ordenes/[id]/page.tsx         # Detalle de orden del cliente
│   │   └── puntos/page.tsx               # Ledger de puntos
│   ├── admin/
│   │   ├── flash-codes/
│   │   │   ├── page.tsx                  # Listado
│   │   │   ├── new/page.tsx              # Crear
│   │   │   └── [id]/page.tsx             # Editar
│   │   └── metrics/page.tsx              # Métricas avanzadas
│   └── api/
│       ├── user/points/route.ts          # GET balance del usuario
│       └── flash-codes/
│           ├── route.ts                  # POST crear, GET listar
│           └── [id]/route.ts             # PUT actualizar, DELETE
├── components/
│   ├── admin/flash-codes/flash-code-form.tsx
│   ├── cart/points-redeemer.tsx          # Selector de redención en checkout
│   └── layout/user-menu.tsx              # Dropdown de usuario en navbar
└── lib/
    └── auth/require-user.ts              # requireUser, getOptionalUser, isUserLoggedIn
```

---

## Reglas de negocio de puntos (recordatorio)

| Concepto | Regla |
|----------|-------|
| Earn | 1 punto por cada $1 pagado → `floor(total_cents / 100)` |
| Redeem | 10 puntos = $1 → `floor(points / 10) * 100` centavos |
| Mínimo redención | 10 puntos (múltiplo) |
| Cálculo | SIEMPRE en backend (valida saldo contra DB) |
| Idempotencia | `award_points()` no duplica si ya se acreditó |
| Reembolso | En Fase 5: al reembolsar orden, revertir puntos ganados |

---

## Seguridad

- **RLS sigo activo:** el cliente solo puede leer sus propias órdenes (policy `orders: owner read`).
- **Validación de saldo server-side:** `createOrder` verifica que el customer tenga suficientes puntos antes de aplicar el descuento.
- **Admin verificado dos veces:** sesión Auth + fila en `public.admins` para todas las rutas `/admin/*`.
- **Magic link con redirect verificado:** el `emailRedirectTo` siempre apunta a nuestro dominio.
- **Logout con next param:** permite redirigir a login (cliente) o a home (desde navbar).

---

## Siguiente: Fase 5/5 (final)

Endurecimiento y puesta en producción:

- **Cloudflare Turnstile** en todos los formularios sensibles (login, registro, checkout, validación de flash codes).
- **Edge Functions** en Supabase para migrar API routes críticas (webhook de pago, consume_flash_code) — mejor latencia y disponibilidad.
- **Emails transaccionales:** confirmación de orden, magic link personalizado, recordatorio de puntos.
- **SEO + Open Graph:** metadatos por producto, sitemap.xml, robots.txt.
- **Auditoría final:** revisión de RLS, idempotencia de webhooks, manejo de edge cases (stock negativo, puntos negativos).
- **Tests:** e2e con Playwright para el flujo completo de compra.
- **Documentación final:** README actualizado, guide de deployment, runbook de incidentes.
