'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ImageOff, Sparkles, Tag, ShoppingCart, Check, Lock, Gift } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import type { ProductCondition, ProductGrading } from '@/types/database'

export interface ProductCardData {
  id: string
  slug: string
  title: string
  price_cents: number
  condition: ProductCondition
  grading: ProductGrading | null
  image_url?: string | null
  stock?: number
  flash_badge?: string | null
  flash_discount_percent?: number | null
  flash_code?: string | null
}

const CONDITION_LABEL: Record<ProductCondition, string> = {
  new: 'Nuevo',
  used: 'Usado',
}

const GRADING_LABEL: Record<ProductGrading, string> = {
  excelente: 'Excelente estado',
  buena: 'Buen estado',
  regular: 'Estado regular',
}

/** Mystery Box — slug reservado para producto no clickeable */
const MYSTERY_BOX_SLUG = 'mystery-box'
const MYSTERY_BOX_PRICE_CENTS = 0 // centinela

export function ProductCard({ product }: { product: ProductCardData }) {
  const addItem = useCart((s) => s.addItem)
  const [added, setAdded] = useState(false)

  const isMysteryBox = product.slug === MYSTERY_BOX_SLUG
  const outOfStock = product.stock !== undefined && product.stock <= 0
  const hasFlashDiscount = product.flash_discount_percent != null && product.flash_discount_percent > 0
  const finalPrice = hasFlashDiscount
    ? Math.round(product.price_cents * (1 - (product.flash_discount_percent as number) / 100))
    : product.price_cents

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (outOfStock || isMysteryBox) return
    addItem({
      id: product.id,
      slug: product.slug,
      title: product.title,
      unit_price_cents: finalPrice,
      image_url: product.image_url,
      condition: product.condition,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  // ----- Mystery Box: versión bloqueada y compacta -----
  // Diseñado para que NO sea más alto que una card normal,
  // así no fuerza a las demás cards de la fila a estirarse.
  if (isMysteryBox) {
    return (
      <Card className="group flex flex-col overflow-hidden border-dashed border-accent/40 bg-accent/5 transition-all hover:shadow-md gap-0 py-0">
        {/* Imagen bloqueada con badge Próximamente */}
        <div className="relative block aspect-square overflow-hidden bg-accent/10">
          <div className="flex h-full w-full items-center justify-center text-accent">
            <Gift className="h-16 w-16 opacity-60" aria-hidden />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-background/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent backdrop-blur-sm">
              <Lock className="mr-1 inline h-3 w-3" aria-hidden />
              Próximamente
            </div>
          </div>
        </div>

        {/* Solo título — sin descripción, sin precio, sin botón */}
        <CardContent className="flex flex-1 flex-col px-3 pt-1 pb-1">
          <div className="line-clamp-2 text-sm font-medium leading-snug text-accent/70">
            {product.title}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ----- Producto normal -----
  return (
    <Card className="group flex flex-col overflow-hidden border-black/5 bg-white transition-all hover:shadow-md hover:border-black/10 gap-0 py-0">
      {/* Imagen */}
      <Link
        href={ROUTES.producto(product.slug)}
        className="relative block aspect-square overflow-hidden bg-munay-cream/20"
        aria-label={`Ver ${product.title}`}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-munay-ink/30">
            <ImageOff className="h-12 w-12" aria-hidden />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <Badge variant={product.condition === 'new' ? 'default' : 'secondary'}>
            {CONDITION_LABEL[product.condition]}
          </Badge>
          {hasFlashDiscount && (
            <Badge className="bg-munay-red-600 text-white border-0">
              <Tag className="mr-1 h-3 w-3" aria-hidden />
              -{product.flash_discount_percent}%
            </Badge>
          )}
          {product.flash_code && !hasFlashDiscount && (
            <Badge className="bg-munay-cream text-munay-ink border-0">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
              Desbloqueado
            </Badge>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-munay-ink px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
              Agotado
            </span>
          </div>
        )}
      </Link>

      {/* Contenido + Precio + Botones en un solo bloque flex-col */}
      {/* flex-1 distribuye el espacio extra al final (debajo de botones), no entre secciones */}
      <CardContent className="flex flex-1 flex-col px-3 pt-1 pb-1">
        <Link
          href={ROUTES.producto(product.slug)}
          className="line-clamp-2 text-sm font-medium leading-snug text-munay-ink transition-colors hover:text-munay-red-600"
        >
          {product.title}
        </Link>
        {product.grading && (
          <p className="mt-0.5 text-[11px] text-munay-ink/50">{GRADING_LABEL[product.grading]}</p>
        )}

        {/* Precio — inmediatamente después del grading */}
        <div className="flex items-baseline gap-1.5 mt-1">
          {hasFlashDiscount && (
            <span className="text-xs text-munay-ink/40 line-through">
              {formatCents(product.price_cents)}
            </span>
          )}
          <span className={`text-base font-semibold ${hasFlashDiscount ? 'text-munay-red-600' : 'text-munay-ink'}`}>
            {formatCents(finalPrice)}
          </span>
        </div>

        {/* Botones — inmediatamente después del precio */}
        <div className="flex gap-1.5 mt-1">
          <Button asChild size="sm" variant="outline" className="flex-1 h-8 text-xs">
            <Link href={ROUTES.producto(product.slug)}>Ver</Link>
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-munay-red-600 text-white hover:bg-munay-red-800"
            disabled={outOfStock}
            onClick={handleAddToCart}
          >
            {added ? (
              <>
                <Check className="mr-1 h-3 w-3" aria-hidden />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1 h-3 w-3" aria-hidden />
                {outOfStock ? 'Sin stock' : 'Agregar'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
