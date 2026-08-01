# 🚀 Guía de Deploy CI/CD — Munay

## 📋 Resumen del Pipeline

```
Git push → main
    │
    ├── GitHub Actions (CI)
    │   ├── quality: typecheck + lint
    │   ├── build: (solo si quality pasa)
    │   │   └── usa secrets de GitHub
    │   └── ✅ CI pasa
    │
    └── Vercel (CD — auto-deploy)
        ├── GitHub-Vercel integration
        ├── Build: npm ci + next build
        ├── Deploy: automático
        └── ✅ https://munay-audited-v01.vercel.app
```

## 1️⃣ GitHub Actions — CI (Control de Calidad)

El workflow `.github/workflows/ci-cd.yml` corre en cada **push a main** y **PR contra main**:

### Jobs

| Job | Comando | Propósito |
|-----|---------|-----------|
| `quality` | `npm run typecheck` + `npm run lint` | Verificar tipos y estilo |
| `build` | `npm run build` (needs: quality) | Build de producción |

### Secrets requeridos en GitHub

Configurados vía `gh secret set`:

| Secret | ¿Necesario? | Nota |
|--------|-------------|------|
| `DATABASE_URL` | ✅ Sí | Conexión a Neon (build necesita schema) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Sí | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ Sí | Clerk secret key |
| `BREVO_API_KEY` | ✅ Sí | Brevo emails (build no falla sin ella) |
| `FROM_EMAIL` | ✅ Sí | Remitente de emails |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ⚠️ Testing | Usa keys de testing por ahora |
| `TURNSTILE_SECRET_KEY` | ⚠️ Testing | Usa keys de testing por ahora |
| `NEXT_PUBLIC_SITE_URL` | ✅ Sí | `https://munay-audited-v01.vercel.app` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | ✅ Sí | WhatsApp wa.me (F3.3 #4 — se inlinea en build) |

> **Nota**: `CRON_SECRET` NO va en GitHub Secrets — es runtime-only del cron en
> Vercel (la route `/api/cron/expire-orders` lo lee en producción; el build de
> CI nunca lo ejecuta). Configúralo solo en Vercel env vars.

### Para agregar/modificar un secret

```bash
echo "VALOR" | gh secret set NOMBRE_SECRET --repo DJ500-sadpou/munay
```

## 2️⃣ Vercel — CD (Deploy Automático)

Con la integración **GitHub → Vercel** activa:

1. **Cada push a `main`** → Vercel detecta el cambio, hace build y deploy automático
2. **Cada PR** → Vercel crea un **Preview Deployment** con URL única
3. **No necesitas** `vercel deploy --prod` manual

### Env Vars en Vercel

Configuradas vía `vercel env add`:

| Variable | Entorno | Estado |
|----------|---------|--------|
| `DATABASE_URL` | Production | ✅ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production | ✅ |
| `CLERK_SECRET_KEY` | Production | ✅ |
| `BREVO_API_KEY` | Production | ✅ |
| `FROM_EMAIL` | Production | ✅ |
| `CRON_SECRET` | Production | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Production | ✅ |
| `PAYMENT_SANDBOX` | Production | ✅ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production | ⚠️ Testing |
| `TURNSTILE_SECRET_KEY` | Production | ⚠️ Testing |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Production | ✅ (F3.3 #4 — fallback en constants) |

### Preview Deployments (PRs)

Para que los Preview Deployments de PRs funcionen con Clerk:

1. En **Clerk Dashboard** → **Sessions** → agregar `https://*-sad-d.vercel.app` como dominio permitido
2. O agregar en **Clerk** → **Domains** → el wildcard de Vercel previews

## 3️⃣ Flujo de Trabajo Recomendado

```
Feature branch → PR a main
    ├── GitHub Actions corre quality + build
    ├── Vercel crea Preview Deployment
    ├── Revisas el preview
    └── Merge a main
        ├── GitHub Actions corre quality + build
        └── Vercel deploy automático a producción
```

### Commands útiles

```bash
# Deploy manual a producción (si no hay auto-deploy)
vercel deploy --prod --yes

# Ver logs de producción
vercel logs munay-audited-v01.vercel.app

# Ver env vars
vercel env ls

# Ver secrets de GitHub
gh secret list

# Ver estado del workflow CI
gh run list
```

## 4️⃣ Troubleshooting

### El build falla en CI pero pasa local

1. Verificar que los secrets de GitHub están configurados (`gh secret list`)
2. Verificar que `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` NO está hardcodeada en el código
3. El `postinstall` script (fix-clerk-mts.mjs) corre automáticamente con `npm ci`

### El deploy de Vercel falla

1. `vercel logs munay-audited-v01.vercel.app` → ver error real
2. Verificar env vars en Vercel: `vercel env ls`
3. Verificar que la integración GitHub-Vercel está activa (Vercel Dashboard → Settings → Git)

### Preview Deployment sin Clerk

Si los preview deployments muestran "Clerk no configurado":
- Agregar wildcard de Vercel en Clerk Dashboard → Domains
- O agregar `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` en Vercel para todos los entornos

## 5️⃣ Mejoras Futuras para CI/CD

- [ ] Agregar job `deploy` al workflow (si se desactiva auto-deploy de Vercel)
- [ ] Agregar `test:e2e` al pipeline (Playwright)
- [ ] Configurar Vercel Deployment Protection (Pro plan) para que CI gatee el deploy
- [ ] Migrar de `middleware.ts` a `proxy` (Next.js 16 deprecation)
