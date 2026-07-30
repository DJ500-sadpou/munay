# Plan Cloudflare — Munay v0.1

> Basado en los grafos del proyecto (`docs/grafos/`) y análisis técnico.
> **Fecha:** Julio 2026 | **Proyecto:** Next.js 16 en Vercel

---

## 📊 Datos del proyecto (desde grafos)

| Métrica | Valor |
|:---|---:|
| Módulos totales | 127 |
| Dependencias entre módulos | 305 |
| Rutas (App Router) | 24 |
| Componentes UI (shadcn) | 17 |
| Servicios cloud activos | Vercel, Neon, Clerk, Brevo, Kushki |

---

## 🎯 Servicios Cloudflare aplicables

| # | Servicio | Prioridad | Plan Free | ¿Requiere tarjeta? |
|:---:|:---|---:|:---:|:---:|
| **1** | **R2** (images storage) | 🔴 Alta — Fase 2 | 10 GB, egress 0$ | ✅ Sí (pero no cobra si no excedes) |
| **2** | **Turnstile** (producción) | 🔴 Alta — Ahora | Ilimitado gratis | ❌ No |
| **3** | **Images** (optimización) | 🟡 Media | 5000 transforms/mes | ❌ No (saldo necesario para más) |
| **4** | **Workers/Pages** | ⚪ Baja | 100k req/día | ❌ No |

---

## ✅ Fase 1 — Turnstile a producción (inmediata)

### ¿Qué es?
Cloudflare Turnstile ya está integrado en Munay:
- `lib/auth/turnstile.ts` — validación server-side
- `components/auth/turnstile-widget.tsx` — widget cliente
- Usado en: checkout, creación de tickets

### Estado actual
```env
# .env.local — Claves de PRUEBA (no protegen nada)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Pasos

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com/) → Turnstile → Add Widget
2. Crear widget con dominio: `munayy.vercel.app` (y `localhost` para dev)
3. Copiar Site Key y Secret Key
4. Actualizar `.env.local`:
   ```env
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...real
   TURNSTILE_SECRET_KEY=0x4AAAA...real
   ```
5. Actualizar en Vercel:
   ```bash
   npx vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY
   npx vercel env add TURNSTILE_SECRET_KEY
   ```
6. **No requiere wrangler ni deploy** — solo cambio de keys.

---

## ✅ Fase 2 — R2 para imágenes de producto (Fase 2 del proyecto)

### ¿Por qué R2 y no Cloudinary?

| Característica | Cloudinary (25 GB) | Cloudflare R2 (10 GB) |
|:---|---:|:---:|
| Almacenamiento gratis | 25 GB | 10 GB |
| Egress (ancho de banda) | **Gasta créditos** 🚫 | **0$ — ilimitado** ✅ |
| Optimización imágenes | Sí (integradas) | Necesita Images o lib externa |
| Sin tarjeta | ✅ No requiere | ❌ Requiere tarjeta |

**Decisión:** Si no te importa dar tarjeta → **R2** (escala mejor). Si no quieres dar tarjeta → **Cloudinary** (25 GB sin tarjeta).

### Si eliges R2 — Pasos

#### 1. Crear cuenta Cloudflare
```bash
# No necesita wrangler, solo dashboard
# Ir a https://dash.cloudflare.com/sign-up
```

#### 2. Instalar SDK
```bash
npm install @aws-sdk/client-s3
# API compatible con S3
```

#### 3. Configurar bucket
```bash
npx wrangler login
npx wrangler r2 bucket create munay-product-images
# Crear token de API: R2 → Manage R2 API Tokens
```

#### 4. Configurar env
```env
# .env.local
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=munay-product-images
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

#### 5. Crear SDK wrapper
Archivo: `src/lib/storage/r2.ts`
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadImage(file: Buffer, key: string, contentType: string) {
  await R2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  }))
}

export async function getImageUrl(key: string) {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`
}
```

#### 6. API route para subida desde admin
Archivo: `src/app/api/admin/products/upload/route.ts`
```typescript
// Usa el SDK de R2 para recibir multipart/form-data
// y devolver la URL pública
```

#### 7. UI de subida en admin (product-form)
```typescript
// Componente drag-and-drop + preview
// Antes de guardar el producto, sube la imagen a R2
// Guarda la URL devuelta en product_images
```

#### 8. Configurar next/image
```typescript
// next.config.ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'pub-*.r2.dev',
    },
  ],
}
```

### Arquitectura final de imágenes

```
Admin sube foto → POST /api/admin/products/upload → R2 bucket → URL pública
                                                          ↓
                                               next/image optimiza
                                               y cachea en Vercel CDN
```

---

## 🟡 Fase 3 — Cloudflare Images (optimización, opcional)

Si ya tienes R2, puedes agregar Cloudflare Images para optimización:

```typescript
// Usar la URL de Cloudflare Images con variantes:
// https://images.cf/your-hash/fit=cover,width=400,height=400/{R2_URL}
```

Pero **next/image** de Vercel ya hace esto automáticamente con `remotePatterns`. Solo vale la pena si migras a Cloudflare Workers como hosting.

---

## ⚪ Fase 4 — Migración a Cloudflare Workers/Pages (NO RECOMENDADO)

### Análisis desde grafos

El proyecto Munay tiene **24 rutas**, y muchas son serverless:
- `/api/admin/*` — requireAdmin()
- `/api/orders/*` — neon + turnstile
- `/api/payments/*` — kushki
- `/api/cron/*` — vercel cron jobs

### Problemas de migrar a Cloudflare Workers

| Aspecto | Vercel (hoy) | Cloudflare Workers |
|:---|---:|:---:|
| Serverless functions | ✅ Nativo | ❌ OpenNext (adaptador) |
| Neon DB | ✅ Funciona | ✅ Funciona |
| Clerk auth | ✅ Nativo | ❌ Requiere configuración extra |
| Kushki webhooks | ✅ Nativo | ❌ Requiere testing |
| Cron jobs | ✅ Vercel Cron | ❌ Workers Cron Triggers |
| Memoria serverless | Hasta 4 GB | **128 MB fijo** 🚫 |
| CI/CD | ✅ Git + Vercel | ❌ Configurar manual |

### Veredicto

> **No migrar a Cloudflare Workers/Pages.** El proyecto está construido nativamente para Vercel y migrarlo requeriría:
> - Reescribir ~15 API routes
> - Configurar OpenNext + wrangler
> - Migrar Cron Jobs
> - Perder integración nativa con Clerk y Kushki
> - Límite de 128 MB de memoria (peligroso para e-commerce)

Si en el futuro quisieras:
- **Edge-case específico**: usa Workers para una tarea concreta (ej: reescritura de imágenes)
- **CDN externa**: solo pon Cloudflare proxy delante de Vercel (DNS)

---

## 📋 Resumen de acciones

| Prioridad | Acción | Dificultad | Tiempo estimado |
|:---:|---|:---:|:---:|
| 🔴 **Ahora** | Turnstile a producción (cambiar keys) | 🟢 Fácil | 10 min |
| 🔴 **Fase 2** | R2 para imágenes (o Cloudinary) | 🟡 Media | 2-3 sesiones |
| 🟡 **Futuro** | Cloudflare Images (optimización extra) | 🟢 Fácil | 30 min |
| ⚪ **No** | Migrar a Workers/Pages | 🔴 Compleja | ~1 semana |

---

## 📁 Archivos afectados (según grafos)

### Turnstile (ya existe)
```
src/lib/auth/turnstile.ts        ← Solo cambiar keys en .env
src/components/auth/turnstile-widget.tsx
src/app/api/orders/route.ts      ← Usa requireTurnstile()
src/app/api/tickets/route.ts     ← Usa requireTurnstile()
```

### R2 (nuevos archivos)
```
src/lib/storage/r2.ts            ← SDK wrapper (NUEVO)
src/app/api/admin/products/upload/route.ts  ← API upload (NUEVO)
src/components/admin/image-upload.tsx       ← UI subida (NUEVO)
next.config.ts                               ← remotePatterns (modificar)
.env.local                                   ← R2 keys (modificar)
```
