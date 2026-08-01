# Guía de despliegue — Munay v0.1 (Neon + Brevo + Clerk, auditada)

> **Versión:** `munay-audited-v0.1` — tras aplicar los 9 fixes críticos + 6 fixes adicionales de reauditoría.
> **Stack:** Next.js 16 + Neon Postgres + Clerk Auth + Brevo (emails) + Vercel + Cloudflare + Kushki.
> **100% gratuito sin tarjeta** (excepto pasarela PCI en producción, que requiere KYC por ley en Ecuador).

---

## Estado de la auditoría (v0.1)

| Auditoría | Hallazgos | Críticos | Estado |
|-----------|-----------|----------|--------|
| Original (Supabase) | 102 | 15 | Documentada |
| Migración (Neon) | 67 | 9 | 9 fixes aplicados |
| **Esta versión (v0.1)** | **13** | **1** | **6 fixes adicionales aplicados** |

### Fixes aplicados en v0.1 (post-reauditoría)

- ✅ **FLOW3-001** (CRÍTICA): `markOrderCancelled` + `expire_stale_pending_orders` ahora devuelven puntos redimidos cuando la orden se cancela/expira.
- ✅ **FLOW3-002** (ALTA): 5 endpoints migrados a `query()` directa (flash-codes, flash/validate, cron, sitemap).
- ✅ **FLOW3-004** (ALTA): `/api/user/points` ahora sincroniza `customer.user_id` (no solo `requireUser`).
- ✅ **FLOW3-005** (ALTA): Webhook rechaza headers sin timestamp SIEMPRE (no fallback).
- ✅ **FLOW3-006** (ALTA): Webhook detecta segundos vs ms automáticamente (heurística `< 1e10`).
- ✅ **FLOW3-007** (MEDIA): Webhook soporta hex y base64, compara bytes binarios.
- ✅ **FLOW3-013** (BAJA): Cron usa `timingSafeEqual` en vez de `!==`.

### Pendientes resueltos (v0.1)

Todos los hallazgos de la auditoría han sido corregidos:

- ✅ **FLOW3-003**: App crashea si faltan credenciales Clerk. **Mitigación:** documentado como comportamiento esperado.
- ✅ **FLOW3-008**: Resuelto (sitemap migrado a query directa Neon).
- ✅ **FLOW3-009**: `shipping_cents` ahora se envía desde el checkout y se incluye en `total_cents` en la DB.
- ✅ **FLOW3-010**: `award_points` ya no falla silenciosamente — loggea warning y retorna `pointsWarning`.
- ✅ **FLOW3-011**: `ignoreBuildErrors: true` eliminado de `next.config.ts`.
- ✅ **FLOW3-012**: `images.remotePatterns` restringido a `*.ufs.sh`, `*.cloudinary.com` y dominio propio.

---

## Pre-requisitos

- **Node.js 20+** o Bun 1.3+
- Cuentas creadas (todas sin tarjeta):
  - [neon.com](https://neon.com) — Postgres serverless (free, sin pausa)
  - [clerk.com](https://clerk.com) — Auth (free 10K MAU)
  - [brevo.com](https://www.brevo.com) — Emails (free 300/día)
  - [vercel.com](https://vercel.com) — Hosting (Hobby free)
  - [cloudflare.com](https://cloudflare.com) — DNS + Turnstile (free)
  - [github.com](https://github.com) — Repositorio (free)
- **Opcional**:
  - [kushki.com](https://kushki.com) — Pasarela PCI (KYC+RUC para producción)
  - [uploadthing.com](https://uploadthing.com) — Storage imágenes (free 2GB)

---

## FASE A — Setup local (10 min)

```bash
# Descomprime
unzip munay-audited-v0.1.zip -d munay
cd munay

# Instala dependencias
bun install  # o: npm install

# Configura env vars (editar después)
cp .env.example .env.local

# Levanta dev server
bun run dev  # o: npm run dev
```

Abre `http://localhost:3000`. Verás la landing. Sin credenciales, las páginas de catálogo muestran un banner "DB no configurada" (no crashean).

**Importante tras CRIT-1**: si NO configuras `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`, la app entera crashea (FLOW3-003). Estas variables son **obligatorias** para cualquier deploy.

---

## FASE B — Neon Postgres (10 min)

### B.1. Crear proyecto Neon

1. Ve a [neon.com](https://neon.com) → Sign up (Google o GitHub, sin tarjeta).
2. **Create new project** → Name: `munay` → Region: `AWS US East` (o São Paulo).
3. Copia la **connection string** (formato `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
4. Pégala en `.env.local`:
   ```bash
   DATABASE_URL="postgresql://munay_owner:npg_xxx@ep-xxx.neon.tech/munay?sslmode=require"
   ```

### B.2. Aplicar esquema SQL

1. En el dashboard de Neon → **SQL Editor**.
2. Abre `supabase/migrations/neon_schema.sql` localmente, copia TODO.
3. Pega en el SQL Editor de Neon → **Run**.

**Si aparece `ERROR: role "authenticated" does not exist`** (FLOW3-021):
Esto es esperado — el esquema usa `GRANT ... TO authenticated` (rol de Supabase que no existe en Neon). La migración continúa pero los grants fallan. Para arreglarlo:

3. Aplica el parche de roles: copia `supabase/migrations/neon_roles_patch.sql` y ejecútalo en el SQL Editor de Neon.

**Verifica:**
```sql
SELECT count(*) FROM products;  -- Debe retornar 5 (seed)
SELECT count(*) FROM flash_codes;  -- Debe retornar 3 (MUNAY10, MUNAY25, SECRETO)
```

### B.3. Verificar conexión

```bash
# Reinicia el dev server
bun run dev

# En otra terminal:
curl http://localhost:3000/api/payments/webhook
# Debe retornar: {"ok":true,"endpoint":"...","provider":"kushki","mode":"demo"}
```

Si responde 200, Neon está conectado. Si responde 503, revisa `DATABASE_URL`.

---

## FASE C — Clerk Auth (15 min)

### C.1. Crear aplicación Clerk

1. Ve a [clerk.com](https://clerk.com) → Sign up (sin tarjeta).
2. **Create application** → Name: `munay` → Next.js.
3. Copia las API Keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx...`
   - `CLERK_SECRET_KEY=sk_test_xxx...`
4. Pégalas en `.env.local`:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx..."
   CLERK_SECRET_KEY="sk_test_xxx..."
   ```

**Sin estas variables, la app NO funciona** (FLOW3-003). El `ClerkProvider` en `layout.tsx` las necesita.

### C.2. Configurar paths de Clerk

En Clerk dashboard → **User & Authentication** → **Paths**:
- Sign-in: `/cuenta/login`
- Sign-up: `/cuenta/login`
- After sign-in: `/cuenta`
- After sign-up: `/cuenta`
- After sign-out: `/`

### C.3. Configurar email verification

En Clerk → **User & Authentication** → **Email, Phone, Username**:
- Para **dev**: desactiva "Require email verification at sign-up" (acelera testing).
- Para **prod**: activa "Require email verification at sign-up".

### C.4. Reiniciar dev server

```bash
# Reinicia para que ClerkProvider cargue las nuevas keys
bun run dev
```

Visita `http://localhost:3000/cuenta/login` → debe mostrar el formulario `<SignIn>` de Clerk.

### C.5. Crear tu usuario admin

1. Visita `http://localhost:3000/cuenta/login`.
2. Click "Don't have an account? Sign up" → crea tu usuario con email+password.
3. Tras registrarte, serás redirigido a `/cuenta`.
4. En Clerk dashboard → **Users** → busca tu usuario → copia el `user_id` (formato `user_xxxxx`).
5. En Neon SQL Editor:
   ```sql
   INSERT INTO public.users (id, email) VALUES ('user_xxxxx', 'tu@email.com')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
   INSERT INTO public.admins (user_id) VALUES ('user_xxx')
     ON CONFLICT (user_id) DO NOTHING;
   ```

### C.6. Verificar login admin

Visita `http://localhost:3000/admin` → redirige a login Clerk. Tras loguearte, debes ver el panel admin con stats reales.

---

## FASE D — Brevo emails (10 min)

### D.1. Crear cuenta Brevo

1. Ve a [brevo.com](https://www.brevo.com) → Sign up (sin tarjeta).
2. Completa el wizard inicial.

### D.2. Obtener API key

1. Dashboard → **"SMTP & API"** → **"API Keys"** tab.
2. **Generate a new API key** → Name: `munay` → Role: **Transactional**.
3. Copia la key (formato `xkeys-xxx...`).
4. Pégala en `.env.local`:
   ```bash
   BREVO_API_KEY="xkeys-xxx..."
   ```

### D.3. Configurar remitente

1. Brevo → **"Senders & IP"** → **"Senders"** → **"Add a new sender"**.
2. Name: `Munay` → Email: `tu-email-real@gmail.com`.
3. Brevo envía verificación → click el link.
4. En `.env.local`:
   ```bash
   FROM_EMAIL="Munay <tu-email-real@gmail.com>"
   ```

**Sin dominio propio**: usa el email verificado arriba. **Con dominio**: agrega el dominio en Brevo → "Domains" → verifica DNS (SPF, DKIM, DMARC) → usa `FROM_EMAIL="Munay <noreply@tudominio.com>"`.

---

## FASE E — Cloudflare Turnstile (10 min)

### E.1. Crear widget

1. [cloudflare.com](https://cloudflare.com) → Sign up (sin tarjeta).
2. Dashboard → **Turnstile** → **Add widget**.
3. Name: `munay-checkout` → Domain: `localhost` (dev) o tu dominio (prod).
4. Widget mode: **Managed**.
5. Copia:
   - **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Secret Key** → `TURNSTILE_SECRET_KEY`
6. Pégalas en `.env.local`.

### E.2. Testing keys para dev (sin dominio)

Si no tienes dominio, usa las testing keys de Cloudflare (siempre pasan):
- Site key: `1x00000000000000000000AA`
- Secret key: `1x0000000000000000000000000000000AA`

**NO usar estas en producción.**

---

## FASE F — Vercel deploy (15 min)

### F.1. Push a GitHub

```bash
cd munay
git init
git add .
git commit -m "Munay v0.1 — Neon+Brevo+Clerk auditada"
git branch -M main
gh repo create munay --public --source=. --push
# o crea el repo manualmente y: git push -u origin main
```

### F.2. Importar en Vercel

1. [vercel.com](https://vercel.com) → Sign up con GitHub.
2. **Add New** → **Project** → importa `munay`.
3. Framework: **Next.js** (auto-detectado).
4. **NO deploy aún** — primero configura env vars.

### F.3. Variables de entorno (TODAS obligatorias)

En Vercel → **Settings** → **Environment Variables**, agrega:

```
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
DATABASE_URL=postgresql://...  (de Neon)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  (o pk_test_ para staging)
CLERK_SECRET_KEY=sk_live_...  (o sk_test_)
BREVO_API_KEY=xkeys-...
FROM_EMAIL=Munay <noreply@tudominio.com>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4...
TURNSTILE_SECRET_KEY=0x4...
PAYMENT_PROVIDER=kushki
PAYMENT_SANDBOX=true  (cambiar a false en prod)
KUSHKI_PUBLIC_KEY=...  (opcional para demo)
KUSHKI_PRIVATE_KEY=...  (opcional para demo)
KUSHKI_WEBHOOK_SECRET=...  (obligatorio en prod)
CRON_SECRET=  (genera con: openssl rand -hex 32)
NEXT_PUBLIC_WHATSAPP_NUMBER=593959756845  (F3.3 #4 — dígitos sin '+'; fallback en constants.ts)
```

> **⚠️ F4 (módulo cupones/flash/tickets)**: además de las vars de arriba,
> la migración `supabase/migrations/00023_f0_tickets_settings.sql` debe estar
> aplicada en Neon ANTES del deploy (tabla `settings`, columnas de ticket y
> RPC `expire_stale_orders_v2` con `p_process_whatsapp`). Ver sección
> "F4 — Cupones, Flash y Ticket WhatsApp" más abajo.

### F.4. Actualizar Clerk con URL de producción

Tras el primer deploy, sabrás la URL (`munay-xxx.vercel.app`). En Clerk:
- **Paths**: actualiza `After sign-in`/`After sign-up` a la URL completa.
- **API Keys** → allowed origins: agrega `https://tu-dominio.vercel.app`.

### F.5. Deploy

Vercel → **Deployments** → **Redeploy** (o push a main).

### F.6. Verificar cron job

Vercel → tu proyecto → **Cron Jobs** → debe aparecer `/api/cron/expire-orders`.

```bash
# Test manual:
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.vercel.app/api/cron/expire-orders
# Esperado: {"ok":true,"expired_count":0,...}
```

---

## FASE G — Dominio custom (opcional, 10 min)

1. Comprar dominio (~$10/año en Namecheap, GoDaddy, o Cloudflare Registrar).
2. Cloudflare → **Add a Site** → ingresa tu dominio → plan Free.
3. Cambia los nameservers en tu registrar a los de Cloudflare.
4. Vercel → **Settings** → **Domains** → agrega `tudominio.com`.
5. Cloudflare → **DNS** → agrega los records de Vercel (CNAME o A).
6. SSL mode Cloudflare: **"Full (strict)"**.
7. Actualiza env vars con el dominio real:
   - `NEXT_PUBLIC_SITE_URL=https://tudominio.com`
   - Clerk allowed origins: agrega `https://tudominio.com`
   - Turnstile widget: agrega `tudominio.com` a domains
   - Brevo: verifica dominio si quieres `noreply@tudominio.com`

---

## FASE H — Kushki real (opcional, requiere KYC, 2-5 días)

### H.1. Modo demo (default, sin KYC)

Si no configuras `KUSHKI_PUBLIC_KEY`/`KUSHKI_PRIVATE_KEY`, el adapter detecta modo demo automáticamente. En modo demo, `/api/payments/create` simula captura inmediata sin llamar a Kushki.

**Importante**: el webhook en modo demo acepta POSTs sin firma SOLO en `NODE_ENV=development` (FLOW3-005 arreglado). En producción (Vercel), el webhook exige `KUSHKI_WEBHOOK_SECRET`.

### H.2. Sandbox Kushki (con KYC)

1. [kushki.com](https://kushki.com) → "Crear cuenta" → completa KYC (RUC, representante legal, cuenta bancaria).
2. Tras aprobación (2-5 días), obtén credenciales sandbox.
3. Configura en Vercel env:
   ```
   PAYMENT_PROVIDER=kushki
   PAYMENT_SANDBOX=true
   KUSHKI_PUBLIC_KEY=<sandbox>
   KUSHKI_PRIVATE_KEY=<sandbox>
   KUSHKI_WEBHOOK_SECRET=<del dashboard Kushki>
   ```
4. En Kushki dashboard → **Webhooks** → URL: `https://tudominio.com/api/payments/webhook`.

### H.3. Tarjetas de prueba Kushki (sandbox)

| Tarjeta | Resultado |
|---------|-----------|
| 4111111111111111 | Visa aprobada |
| 5111111111111111 | Mastercard aprobada |
| 4999991111111111 | Visa declinada |
| CVV: 123, Vence: 12/28 | Cualquiera |

Más: https://docs.kushki.com/docs/tarjetas-de-prueba

### H.4. Producción

Cambia `PAYMENT_SANDBOX=false` y usa credenciales de producción.

**Antes de producción real, valida el formato del webhook Kushki** (FLOW3-006/007):
1. Haz una compra de prueba en sandbox.
2. Verifica en Vercel logs que el webhook llega y se procesa sin error 401.
3. Si el webhook falla con "Firma inválida", revisa:
   - ¿El header `X-Kushki-Signature` tiene formato `timestamp.hmac`?
   - ¿El timestamp está en segundos o ms? (el código ahora detecta ambos).
   - ¿El HMAC está en hex o base64? (el código ahora soporta ambos).

### H.5. Tokenización Kushki.js (NO implementada en este proyecto)

El checkout actual usa `card_token = 'demo-token-...'`. Para producción real con cobros, debes integrar Kushki.js para tokenización de tarjeta en el cliente. Esto NO está incluido en el código actual.

---

## F4 — Cupones, Flash y Ticket WhatsApp (deploy + QA)

> Requiere: migración 00023 aplicada en Neon (✅ verificado en este proyecto),
> `NEXT_PUBLIC_WHATSAPP_NUMBER` en Vercel env vars y `CRON_SECRET` (ya
> requerido por el cron). Corresponde a las fases F1–F3 de
> `PLAN_MODULOS_CUPONES_FLASH_TICKETS.md`.

### F4.1 — Verificar la migración en Neon (SQL Editor)

```sql
-- settings creada con los 2 valores por defecto
select key, value from public.settings order by key;
-- Esperado: auto_expire_tickets_enabled=true, coupon_first_purchase_warning_threshold=30

-- Columnas de ticket nuevas (00023)
select column_name from information_schema.columns
where table_schema='public' and table_name='tickets'
  and column_name in ('ticket_numero','clerk_user_id','precio_total_cents','descuento_aplicado','fecha_expiracion');
-- Esperado: 5 filas

-- Firma de la RPC (debe existir SOLO la de 3 parámetros)
select p.proname, pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public' and p.proname = 'expire_stale_orders_v2';
-- Esperado: expire_stale_orders_v2(integer, integer, boolean)

-- Índice único parcial de tickets activos
select indexname from pg_indexes where schemaname='public' and indexname='tickets_numero_active_idx';
```

### F4.2 — QA del flujo completo (post-deploy)

1. **Checkout con ticket**: llenar checkout → "Enviar pedido por WhatsApp" →
   debe crear la orden + ticket `pendiente` + redirigir a
   `wa.me/593...` con `*Ticket #1234*` en el mensaje.
2. **Panel admin `/admin/tickets`**: el ticket aparece con Número (#1234),
   Total, Expiración (+72h) y estado `Pendiente`.
3. **Confirmar**: botón "Confirmar" marca el ticket `Confirmado` Y la orden
   `paid` (revisar en `/admin/orders`).
4. **Cron**: con `auto_expire_tickets_enabled=true`, un ticket abandonado >72h
   pasa a `Expirado` y la orden a `cancelled` liberando stock.
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.vercel.app/api/cron/expire-orders
# Esperado: {"ok":true,"expired_count":N,"tickets_expired":M,...}
```
5. **Toggle**: apagar "Expiración automática de tickets" en el panel → el cron
   devuelve `auto_expire_tickets_enabled:false` y los tickets NO expiran.
6. **Turnstile**: en producción con site+secret configurados el challenge
   aparece en checkout y se valida de verdad (sin keys → modo dev permisivo).
7. **No-acumulación flash**: con un ítem flash + cupón, la success page muestra
   el mensaje "mayor a tu cupón… los descuentos no son acumulables".

---

## TROUBLESHOOTING

### "La app crashea con error de ClerkProvider"

**Causa**: Faltan `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` o `CLERK_SECRET_KEY` (FLOW3-003).
**Fix**: Agrégalas en `.env.local` (local) o Vercel env vars (prod). Son obligatorias tras CRIT-1.

### "Webhook retorna 503"

**Causa**: Falta `KUSHKI_WEBHOOK_SECRET` en Vercel env (CRIT-2 exige firma siempre en prod).
**Fix**: Configúralo. En dev local con `NODE_ENV=development` y modo demo, el bypass funciona.

### "Webhook retorna 401 Firma inválida"

**Causas posibles**:
1. `KUSHKI_WEBHOOK_SECRET` no coincide con el del dashboard Kushki.
2. El formato del header no es `timestamp.hmac` (FLOW3-005 ahora rechaza sin timestamp).
3. El timestamp está en segundos y el código ahora lo detecta (FLOW3-006 arreglado).
4. El HMAC está en base64 y el código ahora lo soporta (FLOW3-007 arreglado).

**Diagnóstico**: Revisa Vercel logs → busca `[kushki] Webhook rechazado` para ver el motivo específico.

### "No puedo redimir puntos: 'No tienes cuenta de cliente'"

**Causa**: Tu `customer.user_id` no está sincronizado (FLOW3-004 — ahora arreglado en `/api/user/points`).
**Fix**: Visita `/cuenta` primero (eso sincroniza via `requireUser`). O simplemente recarga `/checkout` — el fetch a `/api/user/points` ahora sincroniza automáticamente.

### "Puntos perdidos tras orden cancelada/expirada"

**Estado**: **ARREGLADO en v0.1** (FLOW3-001). `markOrderCancelled` y `expire_stale_pending_orders` ahora insertan una tx `adjust` positiva devolviendo los puntos.

### "El sitemap.xml no incluye productos"

**Estado**: **ARREGLADO en v0.1** (FLOW3-008). `sitemap.ts` migrado a query directa Neon.

### "Cron job falla con 401"

**Causa**: `CRON_SECRET` no coincide o no está configurado.
**Fix**: Genera con `openssl rand -hex 32`, agrégalo en Vercel env. La comparación ahora es timing-safe (FLOW3-013 arreglado).

### "Emails no llegan"

**Causas**:
- `BREVO_API_KEY` no configurada → logs dicen "dev_mode_logged".
- `FROM_EMAIL` no verificado en Brevo → verifica sender en Brevo → Senders.
- Rate limit: 300/día en free.

### "Login admin falla con 'not_admin'"

**Causa**: Tu Clerk user_id no está en `public.admins` de Neon.
**Fix**:
```sql
-- En Neon SQL Editor:
INSERT INTO public.users (id, email) VALUES ('user_xxx', 'tu@email.com')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO public.admins (user_id) VALUES ('user_xxx')
  ON CONFLICT (user_id) DO NOTHING;
```
Reemplaza `user_xxx` con tu Clerk user ID real.

---

## CHECKLIST FINAL

### Infraestructura
- [ ] Proyecto Neon creado, esquema + parche de roles aplicados.
- [ ] **Migración 00023 aplicada** (settings + tickets + RPC con toggle).
- [ ] `DATABASE_URL` en `.env.local` y Vercel.
- [ ] Proyecto Clerk creado, keys en env.
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (obligatorias).
- [ ] `<ClerkProvider>` en layout, `middleware.ts` creado.
- [ ] Brevo API key + FROM_EMAIL verificado.
- [ ] Cloudflare Turnstile site/secret keys.
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` en Vercel (fallback en constants).
- [ ] Vercel project importado, TODAS las env vars configuradas.
- [ ] `CRON_SECRET` generado y configurado.

### Módulo F4 (cupones/flash/ticket WhatsApp)
- [ ] F4.1: verificación SQL en Neon (settings, columnas, RPC, índice).
- [ ] F4.2: QA checkout → ticket # → WhatsApp → admin confirmar → cron.
- [ ] Toggle `auto_expire_tickets_enabled` funcional en `/admin/tickets`.
- [ ] Turnstile validando en producción (no testing keys).

### Pasarela
- [ ] Modo demo funciona (sin credenciales Kushki).
- [ ] Para prod: cuenta merchant Kushki + KYC + credenciales.
- [ ] `KUSHKI_WEBHOOK_SECRET` configurado (obligatorio en prod).
- [ ] Webhook URL configurada en dashboard Kushki.
- [ ] Tokenización Kushki.js integrada (NO incluida — siguiente paso).

### Verificación post-deploy
- [ ] Home carga sin errores en consola.
- [ ] Catálogo muestra 5 productos.
- [ ] Login Clerk funcional (sign up, login, logout).
- [ ] Compra de prueba en modo demo → orden paid en DB.
- [ ] Email de confirmación recibido.
- [ ] Cron job ejecuta sin error.
- [ ] `/sitemap.xml` incluye URLs de productos.
- [ ] Login admin funcional.

---

## RECURSOS OFICIALES

- **Neon**: https://neon.com/docs
- **Clerk Next.js**: https://clerk.com/docs/nextjs/getting-started/quickstart
- **Brevo**: https://developers.brevo.com/docs/send-a-transactional-email
- **Vercel Cron**: https://vercel.com/docs/cron-jobs/quickstart
- **Cloudflare Turnstile**: https://developers.cloudflare.com/turnstile/get-started/server-side-validation
- **Kushki webhooks**: https://docs.kushki.com/cl/notifications/overview
