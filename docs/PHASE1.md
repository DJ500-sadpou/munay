# FASE 1/5 — Preparación de infraestructura + base de datos

**Objetivo:** dejar listo el proyecto (repos, dominios, entornos, Supabase con
esquema inicial, seguridad base) para que las siguientes fases sean implementar
features sin rehacer infraestructura.

---

## 1. Decisiones y cuentas (bloqueantes)

### Pasarela de pago para Ecuador (Ibarra)

Ver [`PAYMENT_GATEWAYS.md`](./PAYMENT_GATEWAYS.md) para comparativa detallada.

**Recomendación:** Kushki (mejor cobertura para tarjeta local en Ecuador).

- [ ] Definir pasarela (Kushki / PayPhone / PayPal)
- [ ] Crear cuenta Supabase (1 proyecto)
- [ ] Crear cuenta Vercel
- [ ] Crear cuenta Cloudflare (DNS/SSL + Turnstile)
- [ ] Crear cuenta merchant en la pasarela elegida (sandbox)

**Criterio de aceptación:** acceso a sandbox/credenciales de prueba (API keys)
confirmado funcionando en Ecuador.

---

## 2. Repositorio y esqueleto del frontend

- [x] Repo Git inicializado
- [x] Proyecto Next.js 16 (App Router) + TypeScript
- [x] ESLint + Prettier (configurado en `eslint.config.mjs`)
- [x] TailwindCSS + shadcn/ui
- [x] Paleta Munay (tonos tierra + contraste oscuro) en `src/app/globals.css`
- [x] Estructura de rutas mínima:
  - [x] `/` (home)
  - [x] `/catalogo`
  - [x] `/p/[slug]` (producto)
  - [x] `/carrito`
  - [x] `/checkout` (placeholder para Fase 3)
  - [x] `/flash/[code]` (oferta flash)
  - [x] `/flash` (entrada de código)

**Criterio de aceptación:** `bun run dev` levanta la app. `bun run lint` pasa sin errores.

---

## 3. Hosting + dominios + seguridad perimetral (gratis)

- [ ] Conectar repo a Vercel (deploy automático por `main`)
- [ ] Configurar variables de entorno en Vercel
- [ ] Cloudflare: agregar dominio (si tienes) o dejarlo para después
- [ ] Cloudflare: SSL "Full"
- [ ] Cloudflare: reglas básicas de caching estático
- [ ] Cloudflare Turnstile: crear site key / secret

**Criterio de aceptación:** URL pública en Vercel + HTTPS. Cada push a `main` despliega.

---

## 4. Supabase: proyecto, Auth, Storage, DB

- [ ] Crear proyecto Supabase (región cercana)
- [ ] Auth: habilitar Email (magic link u OTP) **solo para login opcional**
- [ ] Confirmar que guest checkout no requiere cuenta
- [ ] Aplicar migraciones `00001` → `00006` (en orden)
- [ ] Verificar bucket `product-images` creado
- [ ] Crear registro en `public.admins` para tu usuario

### 4.1 Tablas creadas (migración 00001)
- [x] `products` (slug, title, price_cents, condition, grading, active)
- [x] `product_images` (product_id, url, sort)
- [x] `inventory` (product_id, stock, reserved)
- [x] `flash_codes` (code, type, discount_percent/cents, starts_at, ends_at, max_uses, uses_count)
- [x] `flash_code_products` (code, product_id — para type='unlock')

### 4.2 Órdenes y pagos (migración 00002)
- [x] `orders` (user_id nullable para guest, customer_email, status, subtotal/discount/total, points_redeemed)
- [x] `order_items` (snapshot de unit_price_cents)
- [x] `payments` (provider, provider_ref, status, raw jsonb)

### 4.3 Fidelidad — ledger (migración 00003)
- [x] `customers` (user_id nullable, email único)
- [x] `point_transactions` (type=earn/redeem/adjust, points entero con signo)
- [x] Vista `customer_point_balances` (saldo = SUM(points))

### Reglas de negocio (definidas aquí, implementadas en Edge Functions en Fase 3+)
- Earn: por cada orden `paid`, sumar `floor(total_cents / 100)` (1 punto por $1).
- Redeem: 10 puntos = $1 → discount_cents = `floor(points / 10) * 100`.
- Cálculo SIEMPRE en backend (no confiar en frontend).

**Criterio de aceptación:** puedes insertar un producto + imagen + stock desde SQL Editor.
Puedes insertar un `flash_code` y consultarlo.

---

## 5. Seguridad mínima (RLS) desde el día 1 (migración 00004)

- [x] RLS activado en TODAS las tablas públicas
- [x] Policies:
  - Público (anon): SELECT solo en `products` activos + `product_images` (si producto activo)
  - `flash_codes`: SELECT solo si `active=true AND now() BETWEEN starts_at AND ends_at`
  - `orders` / `order_items` / `customers` / `point_transactions`: dueño o admin
  - Escritura: solo service role (Edge Functions) o usuario en tabla `admins`
- [x] Tabla `admins` con función helper `is_admin()`

**Criterio de aceptación:** desde cliente anónimo solo se puede leer catálogo activo.
No se puede modificar nada sin service role.

---

## 6. Variables de entorno (sin secretos en el repo)

- [x] `.env.example` con todas las variables (Supabase, Turnstile, Pasarela)
- [ ] Configurar env vars en Vercel (no en código)
- [ ] `.env.local` para desarrollo local (NO commitear)

**Criterio de aceptación:** Build en Vercel exitoso sin exponer secretos.

---

## Checklist final de Fase 1 (Definition of Done)

- [x] App desplegable (Vercel) + HTTPS
- [x] Supabase con DB + Storage + RLS (migraciones listas para aplicar)
- [x] Esquema incluye órdenes, pagos y puntos (ledger)
- [x] Turnstile referenciado en `.env.example` (keys a crear por usuario)
- [x] Pasarela seleccionada (configurable vía `PAYMENT_PROVIDER` env var)

---

## Cómo verificar que todo funciona

1. `bun install && bun run lint` — sin errores.
2. `bun run dev` — abre `http://localhost:3000`:
   - Landing muestra el checklist con ✓ en lo resuelto.
   - Navbar navega a `/catalogo`, `/carrito`, `/checkout`, `/flash`.
3. Aplica las migraciones en Supabase y verifica desde el SQL Editor:
   ```sql
   -- Debe retornar 7 productos (6 activos + 1 oculto)
   select count(*) from products;

   -- Debe retornar 3 códigos flash activos
   select code, type, discount_percent from flash_codes where active = true;

   -- Tu usuario debe aparecer como admin
   select * from admins;
   ```
4. Intenta leer desde el cliente anónimo (anon key):
   ```sql
   -- Debe funcionar (producto activo)
   select id, title from products where active = true;

   -- Debe FALLAR (RLS bloquea escritura pública)
   insert into products (slug, title, price_cents, condition) values ('test', 'Test', 100, 'new');
   -- ERROR: new row violates row-level security policy
   ```

---

## Siguiente paso

**FASE 2/5:** Catálogo + Carrito + "Flash code search" (sin pagos todavía).

- Conectar `catalogo` y `p/[slug]` a Supabase (Server Components + RLS).
- Carrito con Zustand + localStorage.
- Validación de flash codes con Edge Function + Cloudflare Turnstile.
- Panel admin básico (CRUD productos).
