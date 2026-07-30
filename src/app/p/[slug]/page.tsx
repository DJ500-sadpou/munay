import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { Sparkles, ArrowLeft, ShieldCheck, Truck, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  getProductBySlug,
  getValidFlashCode,
  applyFlashDiscount,
} from '@/lib/queries/products'
import { ProductAddToCart } from '@/components/product/product-add-to-cart'
import { parseFiltersFromSearchParams } from '@/lib/queries/products'
import { ROUTES } from '@/lib/constants'
import { formatCents } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase/configured'
import { SupabaseNotConfiguredBanner } from '@/components/catalogo/supabase-not-configured-banner'
import type { ProductCondition, ProductGrading } from '@/types/database'

const CONDITION_LABEL: Record<ProductCondition, string> = {
  new: 'Nuevo',
  used: 'Usado',
}

const GRADING_LABEL: Record<ProductGrading, string> = {
  excelente: 'Excelente estado',
  buena: 'Buen estado',
  regular: 'Estado regular',
}

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // 🎁 Mystery Box: no generar metadata
  if (slug === 'mystery-box') {
    return { title: 'Producto no encontrado', robots: { index: false, follow: false } }
  }

  const product = await getProductBySlug(slug)
  if (!product) {
    return {
      title: 'Producto no encontrado',
      robots: { index: false, follow: false },
    }
  }
  return {
    title: product.title,
    description: product.description ?? `Pieza disponible en Munay por ${formatCents(product.price_cents)}.`,
    openGraph: {
      title: `${product.title} · Munay`,
      description: product.description ?? `Pieza disponible por ${formatCents(product.price_cents)}.`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/p/${product.slug}`,
      siteName: 'Munay',
      type: 'website',
      locale: 'es_EC',
      images: product.image_url ? [{ url: product.image_url, alt: product.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.description ?? `Por ${formatCents(product.price_cents)}.`,
      images: product.image_url ? [product.image_url] : [],
    },
  }
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const filters = parseFiltersFromSearchParams(sp)

  // 🎁 Mystery Box: no permitir acceso directo
  if (slug === 'mystery-box') {
    redirect('/catalogo')
  }

  const product = await getProductBySlug(slug)

  // Si Supabase no está configurado, mostrar banner en lugar de 404.
  if (!product && !isSupabaseConfigured()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href={ROUTES.catalogo}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Volver al catálogo
          </Link>
        </Button>
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-2xl font-semibold mb-4">
            Producto: <span className="text-primary">{slug}</span>
          </h1>
          <SupabaseNotConfiguredBanner />
        </div>
      </div>
    )
  }

  if (!product) notFound()

  // Verificar flash code activo (vía ?flash=CODE en la URL)
  let flashDiscountPercent: number | null = null
  let flashCode: string | null = null
  if (filters.flashCode) {
    const fc = await getValidFlashCode(filters.flashCode)
    if (fc && fc.type === 'discount') {
      const result = applyFlashDiscount(product.price_cents, fc)
      if (result) {
        flashDiscountPercent = result.discountPercent
        flashCode = fc.code
      }
    } else if (fc && fc.type === 'unlock') {
      flashCode = fc.code
    }
  }

  const outOfStock = product.stock <= 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={ROUTES.catalogo}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al catálogo
        </Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Galería de imágenes */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            {product.images.length > 0 && product.images[0].url ? (
              <Image
                src={product.images[0].url}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-munay-ink/30">
                <Sparkles className="h-16 w-16 opacity-30" aria-hidden />
              </div>
            )}
            <Badge className="absolute left-3 top-3" variant={product.condition === 'new' ? 'default' : 'secondary'}>
              {CONDITION_LABEL[product.condition]}
            </Badge>
            {flashDiscountPercent != null && (
              <Badge className="absolute right-3 top-3 bg-munay-red-600 text-white">
                <Tag className="mr-1 h-3 w-3" aria-hidden />
                -{flashDiscountPercent}%
              </Badge>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm"
                >
                  <Image
                    src={img.url}
                    alt={product.title}
                    fill
                    sizes="100px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-munay-ink sm:text-3xl">
            {product.title}
          </h1>

          {product.grading && (
            <p className="mt-2 text-sm text-munay-ink/60">{GRADING_LABEL[product.grading]}</p>
          )}

          <Separator className="my-6" />

          <div className="text-munay-ink/70 text-sm leading-relaxed">
            <p>{product.description ?? 'Sin descripción disponible.'}</p>
          </div>

          <Separator className="my-6" />

          <ProductAddToCart
            product={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              description: product.description,
              price_cents: product.price_cents,
              condition: product.condition,
              grading: product.grading,
              stock: product.stock,
              flash_discount_percent: flashDiscountPercent,
              flash_code: flashCode,
            }}
          />

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-munay-ink/60">
              <Truck className="h-4 w-4 text-munay-red-600" aria-hidden />
              <span>Envíos en Ibarra y todo Ecuador</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-munay-ink/60">
              <ShieldCheck className="h-4 w-4 text-munay-red-600" aria-hidden />
              <span>Pago seguro con pasarela PCI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
