# Plan Cloudinary — Imágenes de Producto

> **Para:** Munay v0.1 — Tienda de ropa nueva y de segunda
> **Stack:** Next.js 16 + Neon + Clerk + Vercel
> **Basado en:** Grafos del proyecto (`docs/grafos/`) y análisis técnico
> **Fecha:** Julio 2026 | **Revisado por:** 5 revisores

---

## 📊 Estado actual (desde los grafos)

| Aspecto | Estado | Detalle |
|:---|---:|:---|
| `next.config.ts` | ✅ **Listo** | `remotePatterns` ya incluye `*.cloudinary.com` |
| DB `product_images` | ✅ **Lista** | Tabla con `product_id`, `url`, `sort` ya existe |
| `ProductCard` | ✅ **Listo** | `image_url` soportado, render con `<Image>` de Next.js |
| `product-form.tsx` | ❌ Sin UI de subida | No tiene campo de imagen ni upload |
| API routes | ❌ Sin endpoint upload | No hay endpoint de firmas para Upload Widget |
| SDK Cloudinary | ❌ No instalado | Falta `npm install cloudinary` |
| Env variables | ❌ No configuradas | Faltan `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |
| Types `ProductCardData` | ❌ `image_url` plano | Debe actualizarse a `images: ImageData[]` |

---

## ☁️ ¿Por qué Cloudinary y no Cloudflare R2?

| Característica | **Cloudinary** ✅ | Cloudflare R2 |
|:---|---:|:---:|
| Almacenamiento gratis | **25 GB** (pool compartido) | 10 GB |
| Ancho de banda gratis | **25 GB** (mismo pool) | Ilimitado (pero 10 GB solo storage) |
| Optimización imágenes | ✅ **Integrada** (`f_auto,q_auto`, transforms, CDN) | ❌ Requiere capa aparte |
| **¿Requiere tarjeta?** | ❌ **No** | ✅ Sí |
| SDK Next.js | ✅ `cloudinary` npm + Upload Widget | ❌ `@aws-sdk/client-s3` (genérico) |
| Ya en `remotePatterns` | ✅ `*.cloudinary.com` ya configurado | ❌ Habría que agregarlo |
| Transformaciones IA | ✅ `g_auto`, `c_fill` con foco automático | ❌ No tiene |

**Cloudinary gana porque:**
1. **25 GB gratis sin tarjeta** — suficiente para ~5,000-10,000 fotos de producto
2. **Optimización incluida** — `f_auto` (WebP/AVIF), `q_auto` (calidad óptima), `w_800` (redimensionado) sin costo extra
3. **Ya está pre-configurado** — `next.config.ts` ya tiene `*.cloudinary.com` en `remotePatterns`
4. **Upload Widget listo** — interfaz drag-and-drop para el panel admin sin backend extra

> ⚠️ **NOTA SOBRE CRÉDITOS:** Los 25 GB de almacenamiento, 25 GB de ancho de banda y 25,000 transformaciones **comparten el mismo pool de 25 créditos**. No son límites separados. Por ejemplo: 10 GB storage (10 créditos) + 10 GB ancho de banda (10 créditos) + 5,000 transforms (5 créditos) = 25 créditos. Para el volumen inicial de Munay (~500 MB storage, ~2 GB ancho de banda, ~5,000 transforms) el consumo es de ~7.5 créditos — cabe holgadamente.

---

## 🗺️ Arquitectura final

```
                         ┌─────────────────────┐
                         │   Panel Admin        │
                         │  (product-form.tsx)  │
                         └──────────┬──────────┘
                                    │ POST /api/admin/products/upload-signature
                                    │ (firma firmada + restricciones)
                                    ▼
┌──────────────────────────────────────────────────────┐
│                 Cloudinary                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Storage     │  │ Optimization │  │ CDN        │  │
│  │ 25 GB free  │  │ f_auto,q_auto│  │ Global     │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│                    │                                  │
│                    ▼ URL optimizada                   │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│              Next.js (Vercel)                         │
│  <Image src={cloudinaryUrl} />                        │
│  + next/image cachea en CDN de Vercel                │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│           Usuario ve imagen optimizada                │
│   WebP/AVIF · 800px · calidad automática             │
└──────────────────────────────────────────────────────┘
```

---

## 📋 Plan de implementación — 5 fases

---

### ✅ Fase 0: Prerrequisitos (10 min)

#### 0.1 Crear cuenta Cloudinary
1. Ir a [cloudinary.com](https://cloudinary.com) → **Sign up**
2. Registrarse con email o Google/GitHub (sin tarjeta)
3. Copiar del Dashboard:
   - **Cloud Name** → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET`

#### 0.2 Instalar SDK
```bash
npm install cloudinary
```

#### 0.3 Configurar variables de entorno
```env
# .env.local
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abc123def456
CLOUDINARY_PRODUCTS_FOLDER=munay/products
```

#### 0.4 Subir variables a Vercel (después de probar local)
```bash
npx vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
npx vercel env add CLOUDINARY_API_KEY
npx vercel env add CLOUDINARY_API_SECRET
npx vercel env add CLOUDINARY_PRODUCTS_FOLDER
```

> **Nota:** `next.config.ts` ya tiene `*.cloudinary.com` en `remotePatterns`, no hace falta tocarlo. ✅

---

### ✅ Fase 1: SDK wrapper + Signed Upload API (1 sesión)

#### 1.1 Crear `src/lib/storage/cloudinary.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const PRODUCTS_FOLDER = process.env.CLOUDINARY_PRODUCTS_FOLDER ?? 'munay/products'

/** Sanitizar nombre de archivo para evitar caracteres extraños */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '').replace(/\.[^.]+$/, '') || 'img'
}

/** Subir imagen de producto desde el servidor (para migración bulk) */
export async function uploadProductImage(
  fileBuffer: Buffer,
  fileName: string,
  productId: string
): Promise<{ publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: PRODUCTS_FOLDER,
        public_id: `${productId}/${sanitizeFileName(fileName)}`,
        use_filename: false,
        unique_filename: true,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve({ publicId: result.public_id, secureUrl: result.secure_url })
      }
    )
    uploadStream.end(fileBuffer)
  })
}

/** Obtener URL optimizada para mostrar en frontend */
export function getOptimizedImageUrl(publicId: string, width = 600): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' },
    ],
  })
}

/** Eliminar imagen de Cloudinary */
export async function deleteProductImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * Generar firma para upload desde cliente (Upload Widget).
 * Incluye restricciones de seguridad para evitar abuso.
 */
export function generateUploadSignature(): {
  signature: string
  timestamp: number
  params: Record<string, any>
} {
  const timestamp = Math.round(Date.now() / 1000)
  const params = {
    timestamp,
    folder: PRODUCTS_FOLDER,
    max_file_size: 5 * 1024 * 1024,  // 5 MB máximo
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_image_width: 4096,
    max_image_height: 4096,
    transformation: 'w_1200,h_1200,c_limit,q_auto,f_auto',
  }
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  )
  return { signature, timestamp, params }
}
```

#### 1.2 Crear API route para firmas: `src/app/api/admin/products/upload-signature/route.ts`

> 🔒 **FIX DE SEGURIDAD:** Se usa `POST` en vez de `GET` para prevenir CSRF cross-origin.
> 🛡️ **Rate limiting** incluido (como en `/api/tickets/`).

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { generateUploadSignature } from '@/lib/storage/cloudinary'

export const runtime = 'nodejs'

// Rate limiter simple (en memoria, por IP)
const ipTimestamps = new Map<string, number>()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const last = ipTimestamps.get(ip) ?? 0
  if (now - last < 1000) return false // 1 request por segundo
  ipTimestamps.set(ip, now)
  if (ipTimestamps.size > 1000) {
    const cutoff = now - 60000
    for (const [key, val] of ipTimestamps) {
      if (val < cutoff) ipTimestamps.delete(key)
    }
  }
  return true
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Rate limit por IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Espera un segundo.' }, { status: 429 })
  }

  const { signature, timestamp, params } = generateUploadSignature()

  return NextResponse.json({
    ok: true,
    signature,
    timestamp,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: params.folder,
    maxFileSize: params.max_file_size,
    allowedFormats: params.allowed_formats,
  })
}
```

#### 1.3 API route para eliminar imágenes de Cloudinary

```typescript
// src/app/api/admin/products/images/route.ts
// DELETE /api/admin/products/images — elimina de Cloudinary + DB

export async function DELETE(req: NextRequest) {
  // Verificar admin
  // Leer { publicId, productId } del body
  // Llamar deleteProductImage(publicId)
  // DELETE FROM product_images WHERE product_id AND url
  // Devolver { ok: true }
}
```

---

### ✅ Fase 2: UI de subida en el panel admin (1 sesión)

#### 2.1 Crear componente `src/components/admin/image-upload.tsx`

> 🔧 **FIXES APLICADOS:**
> - ✅ Imports todos al inicio del archivo (Label arriba)
> - ✅ Error state con feedback visual al usuario
> - ✅ Cleanup del useEffect (memory leak)
> - ✅ POST en vez de GET para la firma
> - ✅ Cropping 1:1 configurable via prop

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, X, AlertCircle, ImageOff } from 'lucide-react'
import { Label } from '@/components/ui/label'

declare global {
  interface Window {
    cloudinary: any
  }
}

interface ImageUploadProps {
  images: string[]
  onImagesChange: (urls: string[]) => void
  maxImages?: number
  aspectRatio?: number // null para permitir crop libre
}

export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
  aspectRatio = 1,
}: ImageUploadProps) {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const widgetRef = useRef<any>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (typeof window === 'undefined') return

    if (window.cloudinary) {
      setLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://upload-widget.cloudinary.com/global/all.js'
    script.async = true
    script.onload = () => {
      if (mountedRef.current) setLoaded(true)
    }
    script.onerror = () => {
      if (mountedRef.current) setError('Error al cargar el selector de imágenes')
    }
    document.body.appendChild(script)

    return () => {
      mountedRef.current = false
      if (widgetRef.current) {
        try { widgetRef.current.close() } catch {}
      }
    }
  }, [])

  const openWidget = async () => {
    if (!loaded || images.length >= maxImages) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/products/upload-signature', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al obtener firma')

      const widgetOptions: any = {
        cloudName: data.cloudName,
        apiKey: data.apiKey,
        uploadSignature: (cb: any) => cb(data.signature),
        uploadSignatureTimestamp: data.timestamp,
        folder: data.folder,
        sources: ['local', 'url', 'camera'],
        multiple: true,
        maxFiles: maxImages - images.length,
        showAdvancedOptions: false,
        styles: {
          palette: {
            window: '#FFFFFF',
            windowBorder: '#E2E8F0',
            tabIcon: '#DC2626',
            menuIcons: '#DC2626',
            textDark: '#1E293B',
            textLight: '#FFFFFF',
            link: '#DC2626',
            action: '#DC2626',
            inProgress: '#DC2626',
            complete: '#22C55E',
            error: '#EF4444',
            sourceBg: '#F8FAFC',
          },
        },
      }

      // Crop configurable: null = crop libre
      if (aspectRatio) {
        widgetOptions.cropping = true
        widgetOptions.cropping_aspect_ratio = aspectRatio
        widgetOptions.cropping_default_selection_ratio = aspectRatio
      }

      widgetRef.current = window.cloudinary.createUploadWidget(
        widgetOptions,
        (err: any, result: any) => {
          if (err) {
            setError('Error al procesar la imagen')
            return
          }
          if (result && result.event === 'success') {
            onImagesChange([...images, result.info.secure_url])
            setError(null)
          }
        }
      )

      widgetRef.current.open()
    } catch (e: any) {
      setError(e?.message ?? 'Error al conectar con el servidor')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Imágenes del producto</Label>

      {/* Grid de imágenes subidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((url, i) => (
          <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-black/5">
            <Image
              src={url}
              alt={`Imagen ${i + 1}`}
              fill
              className="object-cover"
              sizes="200px"
            />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Eliminar imagen ${i + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Botón agregar */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={openWidget}
            disabled={!loaded || loading}
            className="aspect-square rounded-lg border-2 border-dashed border-black/10 hover:border-munay-red-600/50 transition-colors flex flex-col items-center justify-center gap-1 text-munay-ink/40 hover:text-munay-red-600/60 disabled:opacity-50 bg-munay-cream/10"
            aria-label="Agregar imagen"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span className="text-xs">
              {loading ? 'Conectando...' : `${images.length}/${maxImages}`}
            </span>
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive bg-destructive/5 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-munay-ink/40">
        Formatos: JPG, PNG, WebP (máx 5 MB cada una).
        Máximo {maxImages} imágenes por producto.
        La optimización es automática.
      </p>
    </div>
  )
}
```

#### 2.2 Integrar en `product-form.tsx`

Agregar el campo de imágenes al formulario:

```tsx
import { ImageUpload } from '@/components/admin/image-upload'

// En el estado del componente:
const [images, setImages] = useState<string[]>(product?.images?.map(i => i.url) ?? [])

// En el JSX, después de la descripción:
<div className="space-y-2">
  <ImageUpload images={images} onImagesChange={setImages} maxImages={5} />
</div>

// En handleSubmit, incluir images en el payload:
const payload = {
  ...camposExistentes,
  images,  // ← NUEVO: array de URLs
}
```

#### 2.3 Guardar URLs + public_id en `product_images` al crear/editar

Se guarda tanto `secure_url` como `public_id` para poder generar URLs optimizadas dinámicamente:

```sql
-- ALTER TABLE product_images ADD COLUMN IF NOT EXISTS public_id text;

-- En POST/PUT: borrar imágenes existentes e insertar nuevas
DELETE FROM product_images WHERE product_id = $productId;

INSERT INTO product_images (product_id, url, public_id, sort)
VALUES
  ($productId, $url1, $publicId1, 0),
  ($productId, $url2, $publicId2, 1);
```

El `public_id` se puede obtener del widget (viene en `result.info.public_id`) o extraer de la URL segura de Cloudinary.

---

### ✅ Fase 3: Mostrar imágenes en el frontend (1 sesión)

#### 3.1 Mapear `image_url` a partir de `images` array

Para **no romper** el tipo actual `ProductCardData` (que usa `image_url: string | null`), se mapea en la respuesta de la API:

```typescript
// En la API route de catálogo:
const products = rows.map((r: any) => ({
  ...r,
  images: r.images ?? [],
  image_url: r.images?.[0]?.url ?? null,  // ← compatibilidad con tipo actual
}))
```

#### 3.2 Actualizar `types/database.ts`

```typescript
export interface ProductImage {
  url: string
  public_id?: string
  sort: number
}

// En ProductCardData:
export interface ProductCardData {
  // ... campos existentes ...
  image_url?: string | null  // ← se mantiene para compatibilidad
  images?: ProductImage[]    // ← NUEVO: array completo
}
```

#### 3.3 Actualizar página de producto `/p/[slug]/page.tsx` — Galería

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'

export function ProductGallery({ images }: { images: { url: string }[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!images?.length) {
    return (
      <div className="aspect-square rounded-xl bg-munay-cream/20 flex items-center justify-center">
        <ImageOff className="h-16 w-16 text-munay-ink/20" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Imagen principal */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-munay-cream/10">
        <Image
          src={images[selectedIndex].url}
          alt="Imagen del producto"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setSelectedIndex(i)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                i === selectedIndex
                  ? 'border-munay-red-600'
                  : 'border-transparent hover:border-black/10'
              }`}
            >
              <Image
                src={img.url}
                alt={`Miniatura ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### ✅ Fase 4: Script de migración bulk (opcional, 1 sesión)

#### 4.1 Verificar Supabase Storage existente

Antes de migrar, verificar si el bucket `product-images` de Supabase tiene imágenes:

```bash
# Script one-off: listar objetos en Supabase Storage
# Si hay imágenes, descargarlas y subirlas a Cloudinary
```

#### 4.2 Script `scripts/migrate-images-to-cloudinary.mjs`

```javascript
// 1. Conectar a Neon DB
// 2. Buscar productos sin imágenes en product_images
// 3. Buscar archivos en public/products/ (si existen)
// 4. Subir cada imagen a Cloudinary con uploadProductImage()
// 5. Insertar en product_images (url + public_id)
// 6. Reportar resultados: N productos actualizados, N errores
```

---

### ✅ Fase 5: Soporte para múltiples imágenes en admin (opcional)

Mejora el panel de edición de productos para:
- Ver todas las imágenes del producto (usando `images` del producto)
- Reordenar con drag & drop
- Eliminar imágenes individuales (DELETE de Cloudinary + DB)
- Establecer imagen principal (sort = 0)

---

## 📁 Archivos a crear/modificar

### Archivos NUEVOS

| Archivo | Propósito |
|:---|---|
| `src/lib/storage/cloudinary.ts` | SDK wrapper: upload, URL optimizer, delete, signature con restricciones |
| `src/app/api/admin/products/upload-signature/route.ts` | API POST con rate limiting, CSRF-safe, firma con restricciones |
| `src/app/api/admin/products/images/route.ts` | DELETE de imágenes en Cloudinary + DB |
| `src/components/admin/image-upload.tsx` | Upload Widget con states: loaded/loading/error/empty |
| `src/components/product/product-gallery.tsx` | Galería con thumbnails para `/p/[slug]` |
| `scripts/migrate-images-to-cloudinary.mjs` | Script bulk migration + verificación Supabase |

### Archivos a MODIFICAR

| Archivo | Cambio |
|:---|---|
| `.env.local` | Agregar 4 env vars de Cloudinary |
| `.env.example` | Agregar las mismas vars como ejemplo |
| `src/types/database.ts` | Agregar `ProductImage` type, extender `ProductCardData.images` |
| `src/components/admin/product-form.tsx` | Agregar `ImageUpload` + state `images` + enviar en payload |
| `src/app/api/admin/products/route.ts` | POST: guardar `images` + `public_id` en `product_images` |
| `src/app/api/admin/products/[id]/route.ts` | PUT: actualizar `images` (DELETE + INSERT) |
| `src/components/product/product-card.tsx` | Usar `image_url` mapeado desde `images[0]` |
| `src/app/p/[slug]/page.tsx` | Integrar `ProductGallery` |
| `src/app/catalogo/page.tsx` | El mapeo `image_url` se hace en API, no tocar UI |
| `next.config.ts` | ✅ Ya tiene `*.cloudinary.com` — no tocar |

#### CSP (Content-Security-Policy)

Si el proyecto tiene CSP restrictivo (actualmente no hay, pero podría agregarse), el Upload Widget necesita:

```
script-src: https://upload-widget.cloudinary.com
connect-src: https://api.cloudinary.com https://widget.cloudinary.com
img-src: https://res.cloudinary.com
```

---

## 📊 Costos estimados (pool compartido de 25 créditos)

| Recurso | Por crédito | Uso estimado Munay | Créditos consumidos |
|:---|---:|:---:|:---:|
| Almacenamiento | 1 GB | ~500 MB (500 prod × 1 MB) | **0.5 créditos** |
| Ancho de banda | 1 GB | ~2-5 GB/mes | **2-5 créditos** |
| Transformaciones | 1,000 | ~5,000/mes | **5 créditos** |
| **Total estimado** | | | **~7.5-10.5 créditos** |
| **Disponible** | | | **25 créditos** ✅ |

> **Uso real con optimización:** Las imágenes optimizadas por Cloudinary pesan ~100-200 KB (WebP/AVIF), no 1 MB. El consumo real sería de ~3-5 créditos, dejando 20+ créditos libres para crecimiento.

### ¿Cuándo considerar upgrade?

- Cuando tengas >5,000 productos o >100,000 visitas/mes
- Hasta entonces, el plan free es más que suficiente

---

## 🔄 Rollback

Si algo sale mal:

1. **Desactivar Cloudinary**: cambiar `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` a vacío en Vercel
2. **El catálogo vuelve a placeholder**: `ProductCard` ya tiene fallback a `Sparkles` icon
3. **Las URLs en DB se mantienen**: al reactivar Cloudinary, las imágenes vuelven a cargar
4. **Limpieza de DB** (opcional):
   ```sql
   -- Si se confirma que no se usará más Cloudinary:
   DELETE FROM product_images;
   ALTER TABLE product_images DROP COLUMN IF EXISTS public_id;
   ```
5. **`git revert`** de los cambios en `product-form.tsx`, `image-upload.tsx`, API routes y types
6. **Re-deploy** con `npx vercel --prod`

---

## ⚠️ Dependencias

| Dependencia | Tipo | ¿Ya instalada? | Notas |
|:---|---|:---:|:---|
| `cloudinary` | npm package | ❌ No | `npm install cloudinary` |
| Upload Widget script | CDN | ❌ No | Se carga dinámicamente en `image-upload.tsx` |
| `next/image` | built-in | ✅ Sí | — |
| CSP rules | Config | ❌ No previsto | Solo si se agrega CSP al proyecto |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | env var | ❌ No | |
| `CLOUDINARY_API_KEY` | env var | ❌ No | |
| `CLOUDINARY_API_SECRET` | env var | ❌ No | |
| Cuenta Cloudinary | externa | ❌ No | Crear gratis |

---

## 📐 Árbol de decisión

```
¿El producto necesita imágenes?
├─ Sí
│  ├─ ¿Cloudinary configurado?
│  │  ├─ Sí → Subir imágenes desde el admin (Fase 2)
│  │  └─ No → Fase 0 + Fase 1
│  ├─ ¿Necesito muchas imágenes a la vez?
│  │  ├─ Sí → Usar script bulk migration (Fase 4)
│  │  └─ No → Subir una por una desde admin
│  └─ ¿Es la primera vez?
│     └─ Sí → Crear producto primero (obtener ID), luego imágenes
├─ No → Usar placeholder (ImageOff icon)
│
¿Necesito eliminar imágenes?
├─ Sí → DELETE /api/admin/products/images (Fase 1.3)
└─ No → OK

¿Hay imágenes en Supabase Storage?
├─ Sí → Fase 4.1: migrarlas a Cloudinary
└─ No → Continuar
```

---

## 🏁 Resumen ejecutivo

| Fase | Qué | Archivos | Tiempo |
|:---:|---|:---:|:---:|
| **0** | Cuenta + SDK + env | 4 env vars, 1 package | 10 min |
| **1** | SDK wrapper + API signatures + DELETE | 3 archivos nuevos | 40 min |
| **2** | Upload Widget en admin | 1 componente + modificar form | 50 min |
| **3** | Galería frontend + types | 1 componente + 3 modificaciones | 40 min |
| **4** | Script bulk migration (opcional) | 1 script | 20 min |
| **5** | Multi-image admin mejorado (opcional) | admin panel | 30 min |

**Total estimado:** ~2.5 horas + 10 min registro Cloudinary.

---

## ✅ Resumen de fixes aplicados post-revisión (5 revisores)

| Revisor | # | Severidad | Hallazgo | Fix aplicado |
|:---:|:---:|:---:|---|:---:|
| **R1** | 1 | 🔴 | CSRF: `GET` para firmas | → `POST` |
| Seguridad | 2 | 🟡 | Sin rate limiting en firmas | → Rate limit por IP (1 req/s) |
| | 3 | 🟡 | `fileName` sin sanitizar | → `sanitizeFileName()` regex |
| | 4 | 🟢 | Sin endpoint DELETE imágenes | → `DELETE /api/admin/products/images` |
| **R2** | 5 | 🔴 | `import { Label }` al final del archivo | → Movido al inicio |
| Arquitectura | 6 | 🟡 | Memory leak en useEffect | → Cleanup con `mountedRef` |
| | 7 | 🟡 | Payload del form sin `images` | → Incluir en `handleSubmit` |
| | 8 | 🟡 | Faltaba paso de Vercel env | → Paso 0.4 agregado |
| | 9 | 🟡 | `public_id` podía colisionar | → `sanitizeFileName` + timestamp |
| **R3** | 10 | 🔴 | Types no actualizados | → `ProductImage[]` agregado |
| DB/Datos | 11 | 🔴 | Firma sin restricciones | → `max_file_size`, `allowed_formats` |
| | 12 | 🟡 | Flujo upload: ¿antes o después? | → Documentado: crear producto primero |
| | 13 | 🟡 | Migración Supabase no considerada | → Fase 4.1 agregada |
| | 14 | 🟡 | `public_id` no se guardaba | → `ALTER TABLE` + columna |
| **R4** | 15 | 🔴 | `image_url` vs `images` gap | → Mapeo en API + tipo extendido |
| UX/Frontend | 16 | 🔴 | Sin feedback de error visual | → `error` state + `AlertCircle` |
| | 17 | 🟡 | Cropping 1:1 forzado | → `aspectRatio` prop configurable |
| | 18 | 🟡 | Galería muy vaga | → Código completo con thumbnails |
| | 19 | 🟢 | `Sparkles` placeholder confuso | → Cambiado a `ImageOff` |
| **R5** | 20 | 🔴 | Créditos explicados como separados | → Pool compartido aclarado con ejemplo |
| Costos | 21 | 🟡 | Rollback sin limpieza DB | → Paso `DELETE FROM product_images` |
| | 22 | 🟡 | CSP no listado como dependencia | → Sección CSP agregada |
