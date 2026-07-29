# FASE 5/5 — Endurecimiento + Producción (FINAL)

**Objetivo:** dejar la tienda lista para producción con seguridad reforzada,
observabilidad, SEO, emails transaccionales y tests e2e.

---

## Funcionalidades implementadas

### 1. Cloudflare Turnstile (anti-bot)

**Componentes:**
- `src/components/auth/turnstile-widget.tsx` — widget cliente que carga el script de Turnstile y maneja el challenge.
- `src/lib/auth/turnstile.ts` — verificación server-side con `siteverify` de Cloudflare.

**Endpoints protegidos:**
- `POST /api/orders` — requiere `turnstile_token` en el body.
- `POST /api/flash/validate` — requiere `turnstile_token` en el body.

**Comportamiento en dev:** si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` o `TURNSTILE_SECRET_KEY` no están configurados, el widget muestra un mensaje "modo dev" y la verificación pasa automáticamente.

**Configuración:**
1. Cloudflare Dashboard → Turnstile → Add site.
2. Copia `Site Key` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Copia `Secret Key` → `TURNSTILE_SECRET_KEY`.
4. Reinicia el dev server.

### 2. Migración 00008 (endurecimiento DB)

**Nuevos objetos:**

- **Índices adicionales** para queries frecuentes (productos activos por fecha, órdenes por status, top productos).
- **Tabla `audit_log`** — registra cambios sensibles con RLS (solo admin lee).
- **Trigger `trg_orders_audit`** — audita INSERT y cambios de status en `orders`.
- **Función `expire_stale_pending_orders(p_minutes)`** — cancela órdenes pendientes viejas, libera inventario.
- **Función `refund_order(p_order_id, p_reason)`** — revierte puntos ganados, devuelve puntos redimidos, marca `refunded`, audita.
- **Función `set_audit_actor(p_actor)`** — establece el actor para auditoría (usar antes de funciones sensibles).

### 3. Cron job de limpieza

**Endpoint:** `GET /api/cron/expire-orders`

- Configurado en `vercel.json` para ejecutarse cada 15 min.
- Requiere header `Authorization: Bearer CRON_SECRET`.
- Llama a la RPC `expire_stale_pending_orders(30)`.
- Marca como `cancelled` las órdenes pending >30 min, libera inventario reservado.
- Audita cada expiración.

**Activar en Vercel:**
1. Genera un secret: `openssl rand -hex 32`
2. Configúralo como `CRON_SECRET` en Vercel env vars.
3. Vercel ejecutará el cron automáticamente tras cada deploy.

### 4. Emails transaccionales

**Módulo:** `src/lib/email/index.ts`

- Usa [Resend](https://resend.com) si `RESEND_API_KEY` está configurado.
- Si no, loguea el email a consola (modo dev).
- Templates HTML con diseño branded (paleta Munay: terracota, ámbar, crema).

**Emails implementados:**
- `sendOrderConfirmationEmail` — se envía automáticamente tras `markOrderPaid` (fire-and-forget, no bloquea).
- `sendRefundEmail` — para usar cuando se ejecuta `refund_order`.

**Configuración:**
1. Crea cuenta en [resend.com](https://resend.com) (free tier: 100 emails/día).
2. Verifica tu dominio en Resend.
3. Copia `API Key` → `RESEND_API_KEY`.
4. Configura `FROM_EMAIL="Munay <noreply@tudominio.com>"`.

### 5. SEO + Open Graph

- **`/sitemap.xml`** — generado dinámicamente con:
  - Páginas estáticas (home, catálogo, carrito, etc.).
  - Una entrada por producto activo (con `lastModified` real).
  - `revalidate = 3600` (1 hora).
- **`/robots.txt`** — permite indexar todo excepto rutas privadas (`/admin/`, `/cuenta/`, `/checkout/`, `/api/`).
- **Metadata por producto** (`generateMetadata` en `/p/[slug]`):
  - Title dinámico con el nombre del producto.
  - Description desde la DB.
  - Open Graph con `og:title`, `og:description`, `og:image`, `og:url`, `og:locale=es_EC`.
  - Twitter cards (`summary_large_image`).
  - `robots: { index: false }` si el producto no existe.

### 6. Tests e2e con Playwright

**Configuración:** `playwright.config.ts`
- Test dir: `./tests/e2e`
- Browser: Chromium
- Locale: es-EC, timezone: America/Guayaquil
- Retries en CI: 2

**Tests:** `tests/e2e/checkout-flow.spec.ts`
- Home carga correctamente.
- Catálogo carga.
- Búsqueda de código flash redirige.
- Página de flash code carga.
- Carrito vacío muestra CTA.
- Login carga.
- Admin redirige a login sin sesión.
- sitemap.xml responde 200.
- robots.txt responde 200 con `Sitemap:`.
- Webhook health check.

**Ejecutar:**
```bash
npx playwright install        # instalar navegadores (1 vez)
bun run test:e2e              # correr tests
bun run test:e2e:ui           # modo interactivo
bun run test:e2e:report       # ver reporte HTML
```

### 7. Auditoría de seguridad final

**Verificaciones realizadas:**

| Aspecto | Estado | Notas |
|---------|--------|-------|
| RLS en todas las tablas | ✅ | Migración 00004, verificada. |
| Service role aislado | ✅ | Solo en `src/lib/supabase/admin.ts`, nunca expuesto al cliente. |
| Precios del backend | ✅ | `createOrder` lee precios de DB, no confía en el cliente. |
| Stock atómico | ✅ | `reserve/commit/release_inventory` con `SELECT FOR UPDATE`. |
| Flash codes atómicos | ✅ | `consume_flash_code` con `FOR UPDATE`. |
| Webhook idempotente | ✅ | `award_points` no duplica; `markOrderPaid` chequea status. |
| Webhook firmado | ✅ | `verifyKushkiWebhookSignature` con HMAC. |
| Turnstile en formularios | ✅ | Checkout y flash validate. |
| Logout con redirect | ✅ | Acepta `?next=` param. |
| Guest checkout seguro | ✅ | No requiere login; user_id opcional. |
| Audit log | ✅ | Migración 00008, trigger en orders. |
| Cron protegido | ✅ | Requiere `CRON_SECRET` en header. |
| Refund revierte puntos | ✅ | `refund_order` RPC idempotente. |

---

## Estructura de archivos nuevos en Fase 5

```
src/
├── app/
│   ├── api/
│   │   └── cron/expire-orders/route.ts   # Cron job (Vercel Cron)
│   ├── robots.ts                          # robots.txt dinámico
│   └── sitemap.ts                         # sitemap.xml dinámico
├── components/
│   └── auth/turnstile-widget.tsx          # Widget cliente Turnstile
├── lib/
│   ├── auth/turnstile.ts                  # Verificación server-side
│   └── email/index.ts                     # Emails transaccionales (Resend)
├── supabase/migrations/
│   └── 00008_hardening.sql                # Índices + audit_log + RPCs
├── tests/
│   └── e2e/checkout-flow.spec.ts          # Tests Playwright
├── playwright.config.ts                   # Config Playwright
└── vercel.json                            # Cron schedule
```

---

## Checklist final del proyecto (5 fases)

- [x] **Fase 1:** Infraestructura + DB + RLS (6 migraciones).
- [x] **Fase 2:** Catálogo + carrito + flash codes + admin básico.
- [x] **Fase 3:** Pasarela Kushki + órdenes + webhooks + puntos (migración 00007).
- [x] **Fase 4:** Cuenta usuario + historial + redención + admin completo.
- [x] **Fase 5:** Turnstile + auditoría + emails + SEO + tests (migración 00008).

**Total:** 8 migraciones SQL, 20+ API routes, 14 páginas, ~140 archivos.

---

## Deployment a producción (checklist final)

### 1. Supabase
- [ ] Crear proyecto en región cercana (São Paulo o US East).
- [ ] Aplicar las 8 migraciones en orden (SQL Editor o `supabase db push`).
- [ ] Crear usuario admin en Authentication → Users.
- [ ] Insertar fila en `public.admins` con ese user_id.
- [ ] Verificar que el bucket `product-images` existe.
- [ ] En Authentication → Providers → Email: activar "Confirm email" para prod.
- [ ] En Authentication → URL Configuration: set redirect URL a `https://tudominio.com/cuenta/callback`.

### 2. Vercel
- [ ] Importar el repo desde GitHub.
- [ ] Configurar todas las env vars (ver `.env.example`).
- [ ] Deploy.
- [ ] Verificar que el cron `/api/cron/expire-orders` aparece en Vercel → Cron Jobs.

### 3. Cloudflare
- [ ] Agregar dominio en Cloudflare DNS.
- [ ] SSL mode: "Full" (strict).
- [ ] Crear Turnstile widget → copiar site/secret keys a Vercel env.
- [ ] (Opcional) Activar reglas de caching para `/static/*` y `/images/*`.

### 4. Kushki
- [ ] Crear cuenta merchant en [kushki.com](https://kushki.com).
- [ ] Completar KYC con RUC.
- [ ] Obtener credenciales de producción (`KUSHKI_PUBLIC_KEY`, `KUSHKI_PRIVATE_KEY`).
- [ ] Configurar webhook URL: `https://tudominio.com/api/payments/webhook`.
- [ ] Copiar `Webhook Secret` → `KUSHKI_WEBHOOK_SECRET`.
- [ ] Cambiar `PAYMENT_SANDBOX=false` en Vercel env.

### 5. Resend (emails)
- [ ] Crear cuenta en [resend.com](https://resend.com).
- [ ] Verificar dominio (`munay.com` o el tuyo).
- [ ] Copiar API key → `RESEND_API_KEY`.
- [ ] Set `FROM_EMAIL="Munay <noreply@tudominio.com>"`.

### 6. Verificación post-deploy
- [ ] Visitar `https://tudominio.com/` — debe cargar sin errores.
- [ ] Visitar `https://tudominio.com/sitemap.xml` — debe listar URLs.
- [ ] Visitar `https://tudominio.com/robots.txt` — debe mostrar reglas.
- [ ] Hacer una compra de prueba en modo sandbox (Kushki).
- [ ] Verificar que el email de confirmación llega.
- [ ] Verificar que el webhook registra el pago en `/admin/orders`.
- [ ] Verificar que los puntos se acreditaron en `/cuenta/puntos`.
- [ ] Correr `bun run test:e2e` contra la URL de producción.

---

## Runbook de incidentes

### "Una orden está pagada pero no se acreditó puntos"
1. Verificar en `/admin/orders/[id]` que el payment status sea `captured`.
2. Si está `captured` pero no hay puntos, llamar manualmente la RPC:
   ```sql
   select * from award_points('ORDER_UUID');
   ```
3. La RPC es idempotente, no duplicará.

### "Necesito reembolsar una orden"
1. En SQL Editor:
   ```sql
   select set_audit_actor('admin:tu-email@munay.com');
   select * from refund_order('ORDER_UUID', 'Cliente solicitó reembolso');
   ```
2. Esto marca `refunded`, revierte puntos, devuelve puntos redimidos, audita.
3. El email de notificación se envía automáticamente (si Resend está configurado).

### "Hay muchas órdenes pending que nunca se pagaron"
1. El cron debería limpiarlas cada 15 min automáticamente.
2. Para limpiar manualmente:
   ```sql
   select * from expire_stale_pending_orders(30);
   ```

### "Turnstile no carga en producción"
1. Verificar que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está en Vercel env (no solo local).
2. Verificar que el dominio está agregado en Cloudflare Turnstile dashboard.
3. Revisar consola del navegador por errores de CSP.

### "El webhook de Kushki falla"
1. Verificar que la URL en Kushki dashboard es `https://tudominio.com/api/payments/webhook`.
2. Verificar `KUSHKI_WEBHOOK_SECRET` coincide.
3. Revisar logs en Vercel → Functions → `/api/payments/webhook`.
4. Para reprocesar un webhook manualmente, llamar `markOrderPaid(orderId, providerRef)`.

---

## Optimizaciones futuras (post-launch, opcionales)

- **Edge Functions en Supabase:** migrar `/api/payments/webhook` y `/api/orders` a Edge Functions para menor latencia.
- **CDN para imágenes:** configurar Cloudflare Images o Vercel Image Optimization.
- **A/B testing:** variantes de checkout para optimizar conversión.
- **Analytics:** integrar Plausible/PostHog para tracking de eventos.
- **Magic link branded:** custom email template en Supabase Auth (en lugar del default).
- **Suscripciones:** si se requieren pagos recurrentes,扩展 el modelo con tabla `subscriptions`.
- **Multi-idioma:** next-intl para inglés/español.
- **App móvil:** React Native usando las mismas API routes.
