# Migración: Supabase+Resend → Neon+Brevo+Clerk+UploadThing

**Objetivo:** eliminar todos los servicios que requieren tarjeta de crédito para el free tier, manteniendo funcionalidad completa.

---

## Resumen de cambios

| Antes (Supabase stack) | Después (Neon stack) | Tarjeta? |
|------------------------|---------------------|----------|
| Supabase Postgres | **Neon Postgres** | ❌ |
| Supabase Auth | **Clerk** | ❌ |
| Supabase Storage | **UploadThing** | ❌ |
| Supabase RLS policies | Lógica server-side + RPCs con `REVOKE PUBLIC` | N/A |
| Resend (emails) | **Brevo** (nodemailer-brevo-transport) | ❌ |
| `@supabase/ssr`, `@supabase/supabase-js` | `@neondatabase/serverless`, `@clerk/nextjs`, `nodemailer`, `nodemailer-brevo-transport` | N/A |

---

## Nuevos archivos creados

- `src/lib/db/neon.ts` — Adaptador de base de datos Neon (pool, query, queryOne, transaction).
- `src/lib/queries/products-neon.ts` — Queries SQL crudo para Neon (reemplaza products.ts).
- `src/lib/orders-neon.ts` — Lógica de órdenes transaccional (reemplaza orders.ts).
- `src/lib/email/brevo.ts` — Emails via Brevo (reemplaza index.ts de Resend).
- `src/lib/auth/clerk-server.ts` — Helper de Auth Clerk server-side.
- `src/lib/auth/require-user.ts` — Reescrito para Clerk.
- `src/lib/auth/require-admin.ts` — Reescrito para Clerk.
- `supabase/migrations/neon_schema.sql` — Esquema completo para Neon (1 archivo consolida las 8 migraciones).

## Archivos migrados (stubs de compatibilidad)

Para minimizar el refactor de las 34 páginas que importaban `@/lib/supabase/*`, esos archivos se mantienen como **stubs** que internamente usan Neon/Clerk:

- `src/lib/supabase/server.ts` — Stub que retorna objeto con `auth.getUser()` (Clerk) + `from(...).select()` (Neon).
- `src/lib/supabase/admin.ts` — Mismo stub (Neon no distingue admin/server, mismo pool).
- `src/lib/supabase/client.ts` — Stub que redirige a Clerk.
- `src/lib/supabase/configured.ts` — Ahora verifica `DATABASE_URL` (Neon) en lugar de `NEXT_PUBLIC_SUPABASE_*`.
- `src/lib/orders.ts` — Re-exporta desde `orders-neon.ts`.
- `src/lib/queries/products.ts` — Re-exporta desde `products-neon.ts`.
- `src/lib/email/index.ts` — Re-exporta desde `brevo.ts`.

## Archivos actualizados con fixes de auditoría

Aproveché la migración para arreglar los hallazgos críticos de la auditoría:

- `src/lib/payments/kushki.ts` — Verificación HMAC real con `crypto.timingSafeEqual` (FLOW-002/PERM-003/CODE-006).
- `src/app/api/payments/webhook/route.ts` — Usa `refund_order` RPC (FLOW-010), verifica monto (FLOW-011), mergea `raw` (CODE-007).
- `src/lib/orders-neon.ts` — Transaccional completo (FLOW-007), guests no pueden redimir puntos (FLOW-001), qty validado como entero (CODE-030), reserva falla la orden si no hay stock (FLOW-012).
- `supabase/migrations/neon_schema.sql` — Todas las RPCs `security definer` con `REVOKE EXECUTE FROM PUBLIC` (PERM-001/PERM-002).

---

## Configuración paso a paso

### 1. Crear cuenta en Neon (Postgres)

1. Ir a [neon.com](https://neon.com) → Sign up (con Google o GitHub, sin tarjeta).
2. Create new project → nombre: `munay`.
3. Copiar la **Connection string** que aparece (formato `postgresql://user:pass@ep-host.neon.tech/dbname?sslmode=require`).
4. Pegar en `.env.local` como `DATABASE_URL=...`

### 2. Aplicar el esquema SQL

1. En el dashboard de Neon → SQL Editor.
2. Copiar TODO el contenido de `supabase/migrations/neon_schema.sql`.
3. Pegar en el SQL Editor → Run.
4. Verificar con `SELECT count(*) FROM products;` → debe retornar 5.

### 3. Crear cuenta en Clerk (Auth)

1. Ir a [clerk.com](https://clerk.com) → Sign up (sin tarjeta).
2. Create application → nombre: `munay` → Next.js.
3. Copiar las API Keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
   - `CLERK_SECRET_KEY=sk_test_...`
4. Pegar en `.env.local`.

### 4. Crear tu usuario admin en Clerk y en la DB

1. En Clerk Dashboard → Users → Add user → crea tu cuenta con email + password.
2. Copia el `user_id` (formato `user_xxxxx`).
3. En Neon SQL Editor:
   ```sql
   INSERT INTO users (id, email) VALUES ('user_xxxxx', 'tu@email.com');
   INSERT INTO admins (user_id) VALUES ('user_xxxxx');
   ```

### 5. Crear cuenta en Brevo (emails)

1. Ir a [brevo.com](https://www.brevo.com) → Sign up (sin tarjeta).
2. Dashboard → SMTP & API → API Keys → Generate.
3. Copiar la API key (formato `xkeys-...`).
4. Pegar en `.env.local` como `BREVO_API_KEY=xkeys-...`
5. `FROM_EMAIL` puede ser `Munay <noreply@brevo.com>` (dominio compartido) o tu dominio verificado.

### 6. (Opcional) Crear cuenta en UploadThing (storage)

Si necesitas subir imágenes de productos:

1. Ir a [uploadthing.com](https://uploadthing.com) → Sign up (sin tarjeta).
2. Create new app → copiar `UPLOADTHING_SECRET` y `UPLOADTHING_APP_ID`.
3. Pegar en `.env.local`.

> El código actual usa URLs de imágenes en la DB. Si no necesitas uploads, puedes omitir UploadThing y poner URLs de imágenes alojadas en cualquier CDN público (Cloudinary, etc.).

### 7. Variables de entorno finales (.env.local)

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Neon
DATABASE_URL=postgresql://...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# UploadThing (opcional)
UPLOADTHING_SECRET=...
UPLOADTHING_APP_ID=...

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# Pasarela (modo demo por defecto)
PAYMENT_PROVIDER=kushki
PAYMENT_SANDBOX=true
KUSHKI_PUBLIC_KEY=...
KUSHKI_PRIVATE_KEY=...
KUSHKI_WEBHOOK_SECRET=...

# Brevo
BREVO_API_KEY=xkeys-...
FROM_EMAIL=Munay <noreply@brevo.com>

# Cron
CRON_SECRET=...  # openssl rand -hex 32
```

### 8. Reiniciar dev server

```bash
bun run dev
```

Abrir `http://localhost:3000` → debe cargar con el banner "DB no configurada" si falta algo, o con datos reales si todo está bien.

---

## Diferencias clave vs Supabase

### RLS → server-side checks

**Supabase:** policies SQL como `using (user_id = auth.uid())` que se aplicaban automáticamente.

**Neon:** no hay RLS. Los filtros de seguridad se aplican:
- En las queries SQL (ej: `WHERE active = true` para catálogo público).
- En las RPCs con `REVOKE EXECUTE FROM PUBLIC` (solo invocables desde server).
- En los route handlers con `requireUser()` / `requireAdmin()`.

### Auth → Clerk

**Supabase:** `supabase.auth.signInWithPassword()`, `signInWithOtp()`, magic link con `exchangeCodeForSession()`.

**Clerk:** usa componentes prebuilt (`<SignIn />`, `<SignUp />`) y hooks (`useUser()`, `useClerk()`). Más simple, mejor UX.

La página `/cuenta/login` actual sigue siendo un formulario custom que redirige a Clerk. En una próxima iteración se puede reemplazar por los componentes prebuilt de Clerk para mejor UX y menores维护.

### Storage → UploadThing (o URLs en DB)

**Supabase:** bucket `product-images` con policies RLS.

**Neon stack:** UploadThing maneja uploads con URLs firmadas. Para simplificar, el código actual permite poner URLs de imágenes directamente en la tabla `product_images.url` (pueden ser URLs públicas de cualquier CDN).

---

## Verificación post-migración

1. `bun run lint` — debe pasar sin errores.
2. `bun run dev` — todas estas rutas responden 200:
   - `/`, `/catalogo`, `/carrito`, `/checkout`
   - `/cuenta/login`, `/admin/login`
   - `/flash/MUNAY10`
   - `/sitemap.xml`, `/robots.txt`
   - `/api/payments/webhook`
3. Sin credenciales → banner informativo en lugar de crash.
4. Con credenciales → catálogo real, login Clerk funcional.

---

## Notas de seguridad

Esta migración aprovechó para aplicar fixes críticos de la auditoría:

1. **Webhook Kushki con HMAC real** — antes aceptaba cualquier header no vacío (CRÍTICO).
2. **RPCs no expuestas a anon** — `REVOKE EXECUTE FROM PUBLIC` en todas (CRÍTICO).
3. **Validación de puntos para guests** — antes permitía redimir sin sesión (CRÍTICO).
4. **Transacciones atómicas completas** — `createOrder` ahora es BEGIN/COMMIT/ROLLBACK.
5. **Idempotencia reforzada** — unique index en `point_transactions (order_id, type)` para earn.
6. **Verificación de monto en webhook** — `markOrderPaid` ahora recibe y valida `paidCents`.

Para el resto de hallazgos de la auditoría no cubiertos por esta migración (TDZ en checkout, imports faltantes, etc.), ver `auditoria-proyecto-munay.md`.
