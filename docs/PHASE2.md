# FASE 2/5 — Catálogo + Carrito + Flash code search

**Objetivo:** catálogo en vivo, carrito persistente, validación de códigos flash,
panel admin básico. Sin pagos todavía (Fase 3).

---

## Funcionalidades implementadas

### 1. Catálogo en vivo (Supabase + RLS)

**Ruta:** `/catalogo`

- Server Component que consulta `products` activos con joins a `product_images` e `inventory`.
- Respeta RLS: solo lee productos `active=true`.
- **Filtros** (todos en URL search params, compartibles):
  - `q` — búsqueda libre (ILIKE en title o description).
  - `condition` — `new` / `used` / `all`.
  - `grading` — `excelente` / `buena` / `regular` / `all` (solo aplica a usadas).
  - `minPrice` / `maxPrice` — rango en USD (convierte a centavos en query).
  - `sort` — `recent` (default), `price_asc`, `price_desc`, `title_asc`.
  - `flash` — código flash activo (aplica descuento visible en cards).

### 2. Búsqueda inteligente (la pieza clave que pediste)

**En el buscador del catálogo** (`CatalogSearch`):

1. El usuario escribe cualquier texto y presiona Enter.
2. El server recibe `?q=...` y evalúa con `looksLikeFlashCode(q)`:
   - Heurística: 4-32 chars, alfanumérico, sin espacios, contiene dígito o todo en mayúsculas.
3. **Si parece código flash:** consulta `getValidFlashCode(q)`:
   - Si es válido → `redirect('/flash/[code]')` directo al producto/oferta.
   - Si no es válido → muestra aviso "no es código válido" + resultados normales.
4. **Si no parece código:** hace búsqueda normal con `or(title.ilike, description.ilike)`.

**Ejemplos:**
- Escribes `MUNAY10` → te lleva a `/flash/MUNAY10`.
- Escribes `camiseta` → filtra el catálogo.
- Escribes `chaqueta vaquera` → filtra el catálogo (tiene espacio, no es código).

### 3. Detalle de producto (`/p/[slug]`)

- Galería principal + thumbnails (hasta 4 imágenes).
- Badge de condición (Nuevo/Usado).
- Badge de descuento flash si `?flash=CODE` está en la URL.
- Stock disponible (calculado como `stock - reserved`).
- Componente `ProductAddToCart` (client):
  - Aplica descuento flash al precio unitario si corresponde.
  - Agrega al carrito con feedback visual ("Agregado al carrito" 2s).
  - Muestra aviso si hay código flash activo o CTA para ingresar uno.

### 4. Carrito persistente (`/carrito`)

**Stack:** Zustand + middleware `persist` (localStorage).

- **Persistencia:** el carrito sobrevive recargas y cierre del navegador.
- **Acciones:** agregar, quitar, actualizar cantidad, vaciar.
- **Límites:** máx 50 items por carrito (configurable en `LIMITS.maxItemsPerCart`).
- **Flash code en carrito:** componente `CartFlashCodeInput`:
  - Valida contra `POST /api/flash/validate` (sin consumir uses_count).
  - Muestra descuento aplicado y ahorro total.
  - Permite quitar el código.
- **Cálculos:** subtotal, descuento, envío estimado ($2 flat), total, puntos a ganar.
- **Hidratación segura:** hook `useMounted` con `useSyncExternalStore` para evitar mismatch SSR.

### 5. Validación de flash codes

**Endpoint:** `POST /api/flash/validate`

Body: `{ "code": "MUNAY10" }`
Response válida: `{ valid: true, code, type, discount_percent, discount_cents, ends_at, remaining_uses }`
Response inválida: `{ valid: false, reason: "..." }` con status 400/404/410.

**Reglas verificadas:**
- Código existe en `flash_codes`.
- `active = true`.
- `now()` entre `starts_at` y `ends_at`.
- `uses_count < max_uses` (si max_uses no es null).

**NO incrementa `uses_count`** — eso se hace en Fase 3 al confirmar la orden (Edge Function atómica).

### 6. Página de oferta flash (`/flash/[code]`)

Tres casos:

- **Código inválido/expirado/agotado:** pantalla clara con CTA a catálogo.
- **type=discount:** muestra info del descuento + botón "Ver catálogo con descuento" que lleva a `/catalogo?flash=CODE`.
- **type=unlock:** muestra los productos específicos asociados al código (de `flash_code_products`).

### 7. Checkout (`/checkout`)

- Lee del store de carrito (no más mock).
- Muestra items reales con cantidades.
- Aplica descuento flash si hay código activo.
- Calcula envío + total + puntos a ganar.
- **Botón de pago deshabilitado** (se habilita en Fase 3 con la pasarela real).

### 8. Panel admin (`/admin`)

**Acceso:** login con Supabase Auth + verificación de rol en tabla `admins`.

- `/admin/login` — formulario de login (email + password).
- `/admin` — dashboard con:
  - Stats: total productos, activos, órdenes registradas.
  - Tabla de productos (título, slug, precio, condición, stock, estado).
  - Link a editar cada producto.
  - Link a crear nuevo.
- `/admin/products/new` — formulario de creación.
- `/admin/products/[id]` — formulario de edición (mismo componente).

**APIs:**
- `POST /api/admin/products` — crear producto + inventario (transaccional con rollback).
- `PUT /api/admin/products/[id]` — actualizar producto + upsert inventario.
- `POST /api/auth/logout` — cerrar sesión.

**Seguridad:**
- Toda escritura usa `createAdminClient()` (service role, bypass RLS).
- Verificación doble: sesión Auth + fila en `public.admins`.
- Si no es admin → 403.

### 9. Navbar mejorada

- Contador de items en el carrito (badge dinámico).
- Link "Admin" en menú móvil.
- Botón "Checkout" directo.

---

## Códigos flash de ejemplo (seed)

La migración `00006_seed_sample_data.sql` crea:

| Código | Tipo | Descuento | Comportamiento |
|--------|------|-----------|----------------|
| `MUNAY10` | discount | 10% | Aplica a TODAS las piezas del catálogo |
| `MUNAY25` | discount | 25% | Aplica a TODAS las prendas del catálogo |
| `SECRETO` | unlock | — | Revela 1 prenda oculta (`mystery-box`) |

**Para probar:**
1. En el buscador del catálogo, escribe `MUNAY10` → te lleva a `/flash/MUNAY10`.
2. Desde ahí, clic en "Ver catálogo con descuento" → ves todas las piezas con -10%.
3. Agrega piezas al carrito → ve a `/carrito` → el código ya está aplicado.

---

## Cómo configurar para ver todo en vivo

```bash
# 1. Crea proyecto Supabase y obtén credenciales
#    Settings → API → copia URL, anon key, service role key

# 2. Copia .env.example a .env.local y completa
cp .env.example .env.local
# Edita .env.local con tus valores

# 3. Aplica las 6 migraciones en orden (SQL Editor del dashboard)
#    o usa supabase CLI: supabase db push

# 4. Crea tu usuario admin
#    Authentication → Users → Add user (email + password)
#    Luego en SQL Editor:
insert into public.admins (user_id)
select id from auth.users where email = 'TU_EMAIL';

# 5. Reinicia el dev server y prueba
bun run dev
```

Sin credenciales, las páginas `/catalogo`, `/p/[slug]`, `/flash/[code]` muestran un banner informativo en lugar de crashear.

---

## Estructura de archivos nuevos en Fase 2

```
src/
├── app/
│   ├── admin/
│   │   ├── login/page.tsx              # Login form
│   │   ├── page.tsx                    # Dashboard (productos + stats)
│   │   └── products/
│   │       ├── new/page.tsx            # Crear producto
│   │       └── [id]/page.tsx           # Editar producto
│   ├── api/
│   │   ├── admin/products/
│   │   │   ├── route.ts                # POST crear
│   │   │   └── [id]/route.ts           # PUT actualizar
│   │   ├── auth/logout/route.ts        # POST logout
│   │   └── flash/validate/route.ts     # POST validar código
│   ├── catalogo/page.tsx               # Reescrito con Supabase
│   ├── p/[slug]/page.tsx               # Reescrito con Supabase
│   ├── carrito/page.tsx                # Reescrito con Zustand
│   ├── checkout/page.tsx               # Reescrito con carrito real
│   └── flash/[code]/page.tsx           # Reescrito con validación real
├── components/
│   ├── admin/product-form.tsx          # Form reutilizable crear/editar
│   ├── catalogo/
│   │   ├── catalog-search.tsx          # Buscador con detección de código
│   │   ├── catalog-filters.tsx         # Panel lateral de filtros
│   │   └── supabase-not-configured-banner.tsx
│   ├── cart/cart-flash-code-input.tsx  # Aplicar código en carrito
│   ├── layout/navbar.tsx               # Con contador de carrito
│   └── product/
│       ├── product-card.tsx            # Con badge de descuento + add-to-cart
│       └── product-add-to-cart.tsx     # Botón add-to-cart client
├── hooks/use-mounted.ts                # Hook hidratación segura
├── lib/
│   ├── auth/require-admin.ts           # Guard para rutas /admin
│   ├── queries/products.ts             # Queries Supabase (list, get, flash)
│   └── supabase/configured.ts          # Detecta si hay credenciales
└── store/cart.ts                       # Zustand + persist
```

---

## Siguiente: Fase 3/5

- Integración real de pasarela PCI (Kushki recomendada).
- Creación de órdenes en Supabase (`orders` + `order_items`).
- Webhook handler para confirmar pagos.
- Edge Function para incrementar `uses_count` atómicamente.
- Acreditación de puntos (`point_transactions`) al confirmar pago.
- Cloudflare Turnstile en validación de códigos flash.
