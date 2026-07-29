# Munay — Tienda mística (Ibarra, Ecuador)

> **Fase 5/5 · COMPLETO · Migrado a Neon + Brevo + Clerk · Listo para producción.**
> Proyecto: Next.js 16 (App Router) + Neon (Postgres) + Clerk (Auth) + UploadThing (Storage) + Vercel + Cloudflare + pasarela PCI.

Tienda online completa migrada a stack **100% gratuito sin tarjeta de crédito**:
catálogo en vivo, carrito persistente, códigos flash atómicos, pagos con Kushki
(demo/sandbox/production), cuentas de usuario con Clerk, historial de órdenes,
ledger de puntos con redención, panel admin completo con métricas, y endurecimiento
de producción: Cloudflare Turnstile (con HMAC real), auditoría completa, emails
transaccionales via Brevo, SEO dinámico y tests e2e.

---

## Stack (migrado — sin tarjeta de crédito)

| Capa | Tecnología | Plan gratuito | Tarjeta |
|------|------------|---------------|---------|
| Frontend / API | Next.js 16 + TypeScript + TailwindCSS + shadcn/ui | Vercel Hobby | ❌ No |
| **Base de datos** | **Neon Postgres** (serverless, sin pausa) | Free 0.5 GB | ❌ No |
| **Auth** | **Clerk** (magic link + OAuth) | Free 10K MAU | ❌ No |
| **Storage imágenes** | **UploadThing** | Free 2 GB | ❌ No |
| DNS / SSL / Turnstile | Cloudflare | Free plan | ❌ No |
| Pasarela PCI | Kushki (recomendada) / PayPhone / PayPal | Comisión por tx | KYC sí (prod) |
| **Emails** | **Brevo** (300/día) | Free | ❌ No |

> **Stack 100% gratuito sin tarjeta.** Solo requiere KYC + RUC si se quieren cobros reales (cualquier pasarela PCI en Ecuador lo exige).

---

## Estructura del proyecto

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Layout raíz: navbar + footer + paleta Munay
│   │   ├── page.tsx                # Landing + checklist Fase 1
│   │   ├── globals.css             # Paleta mística (tonos tierra + obsidiana)
│   │   ├── catalogo/page.tsx       # Listado mock
│   │   ├── p/[slug]/page.tsx       # Detalle de producto mock
│   │   ├── carrito/page.tsx        # Carrito cliente (Zustand en Fase 2)
│   │   ├── checkout/page.tsx       # Formulario + resumen (placeholder Fase 3)
│   │   └── flash/
│   │       ├── page.tsx            # Entrada de código flash
│   │       └── [code]/page.tsx     # Oferta flash por código
│   ├── components/
│   │   ├── layout/                 # navbar, footer
│   │   ├── product/                # product-card reutilizable
│   │   └── ui/                     # shadcn/ui (40+ componentes)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client (anon key, cookies)
│   │   │   ├── server.ts           # Server client (cookies + RLS respetado)
│   │   │   └── admin.ts            # Service role (bypass RLS, SOLO server)
│   │   ├── constants.ts            # SITE, POINTS_RULES, PAYMENT, ROUTES
│   │   └── format.ts               # formatCents, calculateEarnedPoints, slugify
│   └── types/database.ts           # Tipos TS del esquema SQL
├── supabase/migrations/
│   ├── 00001_init_schema.sql       # products, product_images, inventory, flash_codes
│   ├── 00002_orders_payments.sql   # orders, order_items, payments
│   ├── 00003_customers_points.sql  # customers, point_transactions (ledger)
│   ├── 00004_rls_policies.sql      # RLS + tabla admins + función is_admin()
│   ├── 00005_storage_buckets.sql   # Bucket product-images + políticas
│   └── 00006_seed_sample_data.sql  # Datos de ejemplo (SOLO dev)
├── docs/
│   ├── PHASE1.md                   # Checklist y Definition of Done
│   └── PAYMENT_GATEWAYS.md         # Comparativa Kushki/PayPhone/PayPal
├── .env.example                    # Variables de entorno (sin secretos)
└── README.md                       # Este archivo
```

---

## Setup local (5 minutos)

### Requisitos
- Node.js 20+ (o Bun 1.3+)
- Cuenta Supabase (free tier)

### Pasos

```bash
# 1. Instalar dependencias
bun install        # o: npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores reales de Supabase

# 3. Aplicar migraciones a Supabase
#    Opción A (recomendada): Supabase CLI
supabase db push
#    Opción B: pegar manualmente cada archivo .sql en el SQL Editor del Dashboard

# 4. Levantar el dev server
bun run dev        # o: npm run dev
# Abre http://localhost:3000
```

---

## Configurar Supabase (10 minutos)

1. **Crear proyecto** en [supabase.com](https://supabase.com) → región US East ( Virginia) o São Paulo (la más cercana a Ecuador).
2. **Settings → API**:
   - Copia `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copia `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copia `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ **NUNCA** en `NEXT_PUBLIC_*`)
3. **SQL Editor** → New query → pega el contenido de cada archivo en `supabase/migrations/` y ejecuta en orden (00001 → 00006).
4. **Storage** → verifica que el bucket `product-images` exista (lo crea la migración 00005).
5. **Authentication → Providers**:
   - Email: habilitado (magic link u OTP).
   - No requerir confirmación para dev; sí para producción.
6. **Authentication → Users** → crea tu usuario admin y luego ejecuta:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'TU_EMAIL_ADMIN@ejemplo.com';
   ```

---

## Deploy en Vercel (5 minutos)

1. Push del repo a GitHub.
2. [vercel.com](https://vercel.com) → Add New Project → importar el repo.
3. **Settings → Environment Variables**: copia todas las variables de `.env.example` (con valores reales).
4. Deploy. Cada push a `main` desplegará automáticamente.

> **Dominio custom (opcional):** Settings → Domains → agregar. Conecta Cloudflare como DNS con SSL "Full".

---

## Cloudflare Turnstile (anti-abuso)

Se usará en Fase 2/3 para proteger:
- Validación de códigos flash (evitar fuerza bruta).
- Formulario de checkout (anti-bot).
- Creación de cuenta (anti-spam).

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site.
2. Copia `Site Key` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Copia `Secret Key` → `TURNSTILE_SECRET_KEY`.

---

## Pasarela de pago (decisión pendiente)

Ver [`docs/PAYMENT_GATEWAYS.md`](docs/PAYMENT_GATEWAYS.md) para comparativa detallada.

**Recomendación:** Kushki (mejor cobertura para tarjeta local en Ecuador).

---

## Reglas de fidelidad (puntos)

| Concepto | Regla |
|----------|-------|
| Earn | 1 punto por cada $1 pagado → `floor(total_cents / 100)` |
| Redeem | 10 puntos = $1 → `floor(points / 10) * 100` centavos de descuento |
| Mínimo redención | 10 puntos (múltiplo) |
| Cálculo | SIEMPRE en backend (Edge Function / Server Action) |

Implementación: tabla `point_transactions` (ledger). El saldo se calcula con la vista `customer_point_balances`.

Helper TS: `src/lib/format.ts` → `calculateEarnedPoints(totalCents)` y `pointsToDiscountCents(points)`.

---

## Rutas disponibles (Fase 5 — final)

| Ruta | Estado | Descripción |
|------|--------|-------------|
| `/` | listo | Landing + checklist final |
| `/catalogo` | en vivo | Catálogo Supabase + filtros + búsqueda inteligente |
| `/p/[slug]` | en vivo | Detalle con galería, stock y add-to-cart + SEO |
| `/carrito` | en vivo | Carrito persistente + aplicar código flash |
| `/checkout` | en vivo | Crear orden + pago + redimir puntos + Turnstile |
| `/checkout/success` | en vivo | Confirmación con puntos ganados |
| `/cuenta` | en vivo | Dashboard del usuario (órdenes + puntos) |
| `/cuenta/login` | en vivo | Magic link + email/contraseña |
| `/cuenta/ordenes` | en vivo | Historial de órdenes del cliente |
| `/cuenta/puntos` | en vivo | Ledger de puntos con saldo |
| `/flash/[code]` | en vivo | Validación real + producto concreto |
| `/admin` | en vivo | Panel admin (productos + órdenes + flash + métricas) |
| `/admin/flash-codes` | en vivo | CRUD de códigos flash |
| `/admin/metrics` | en vivo | Ventas por día + top productos + KPIs |
| `/sitemap.xml` | en vivo | Sitemap dinámico con productos |
| `/robots.txt` | en vivo | Robots.txt con disallow de rutas privadas |
| `/api/cron/expire-orders` | en vivo | Cron job (cada 15 min) — limpia órdenes pendientes |

### Búsqueda inteligente de códigos (destacado)

En el buscador del catálogo:
- Escribe `MUNAY10` → te lleva directo a `/flash/MUNAY10` (descuento 10%).
- Escribe `SECRETO` → te lleva a la pieza oculta desbloqueada.
- Escribe `amazonita` → filtra el catálogo normalmente.

---

## Checklists Definition of Done (todas las fases)

- [Fase 1 — Fundación de infraestructura](docs/PHASE1.md) ✅
- [Fase 2 — Catálogo + Carrito + Flash codes + Admin](docs/PHASE2.md) ✅
- [Fase 3 — Pasarela PCI + órdenes + webhooks + puntos](docs/PHASE3.md) ✅
- [Fase 4 — Cuenta de usuario + historial + redención de puntos](docs/PHASE4.md) ✅
- [Fase 5 — Endurecimiento + producción](docs/PHASE5.md) ✅

**Proyecto completo.** Ver `docs/PHASE5.md` para el runbook de deployment a producción.

---

## Deployment a producción

Ver [`docs/PHASE5.md`](docs/PHASE5.md) → sección "Deployment a producción" para el checklist completo (Supabase, Vercel, Cloudflare, Kushki, Resend) y el runbook de incidentes.

Resumen rápido:
1. Descomprime el .zip → `bun install`
2. `cp .env.example .env.local` y completa credenciales reales.
3. Aplica las 8 migraciones en Supabase (SQL Editor o `supabase db push`).
4. Crea tu usuario admin en Authentication → inserta en `public.admins`.
5. Push a GitHub → import en Vercel → configurar env vars → deploy.
6. Configura Cloudflare (DNS + Turnstile), Kushki (webhook + credenciales prod), Resend (dominio verificado).
7. Verifica con `bun run test:e2e` contra la URL de producción.

---

## Licencia

Privado — © Munay.
