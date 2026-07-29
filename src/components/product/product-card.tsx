'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, Tag, ShoppingCart, Check, Lock, Gift } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
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

  // ----- Mystery Box: versión bloqueada -----
  if (isMysteryBox) {
    return (
      <Card className="group flex flex-col overflow-hidden border-dashed border-accent/40 bg-accent/5 transition-all hover:shadow-md">
        {/* Imagen bloqueada */}
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

        {/* Contenido */}
        <CardContent className="flex-1 px-4 pt-4">
          <div className="line-clamp-2 font-medium leading-snug text-foreground/80">
            {product.title}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contenido sorpresa — disponible pronto</p>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-2 px-4 pb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-accent">???
              <span className="ml-1 text-xs font-normal text-muted-foreground">— sorpresa</span>
            </span>
          </div>
          <Button size="sm" variant="outline" className="flex-1" disabled>
            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden />
            No disponible aún
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // ----- Producto normal -----
  return (
    <Card className="group flex flex-col overflow-hidden border-border/60 bg-card transition-all hover:shadow-lg hover:border-primary/40">
      {/* Imagen */}
      <Link
        href={ROUTES.producto(product.slug)}
        className="relative block aspect-square overflow-hidden bg-muted"
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
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Sparkles className="h-10 w-10 opacity-40" aria-hidden />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <Badge variant={product.condition === 'new' ? 'default' : 'secondary'}>
            {CONDITION_LABEL[product.condition]}
          </Badge>
          {hasFlashDiscount && (
            <Badge variant="default" className="bg-accent text-accent-foreground">
              <Tag className="mr-1 h-3 w-3" aria-hidden />
              -{product.flash_discount_percent}%
            </Badge>
          )}
          {product.flash_code && !hasFlashDiscount && (
            <Badge variant="default" className="bg-accent text-accent-foreground">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
              Desbloqueado
            </Badge>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium uppercase tracking-wider text-background">
              Agotado
            </span>
          </div>
        )}
      </Link>

      {/* Contenido */}
      <CardContent className="flex-1 px-4 pt-4">
        <Link
          href={ROUTES.producto(product.slug)}
          className="line-clamp-2 font-medium leading-snug hover:text-primary transition-colors"
        >
          {product.title}
        </Link>
        {product.grading && (
          <p className="mt-1 text-xs text-muted-foreground">{GRADING_LABEL[product.grading]}</p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2 px-4 pb-4">
        <div className="flex items-baseline gap-2">
          {hasFlashDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatCents(product.price_cents)}
            </span>
          )}
          <span className={`text-lg font-semibold ${hasFlashDiscount ? 'text-primary' : 'text-foreground'}`}>
            {formatCents(finalPrice)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={ROUTES.producto(product.slug)}>Ver</Link>
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={outOfStock}
            onClick={handleAddToCart}
          >
            {added ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1 h-3.5 w-3.5" aria-hidden />
                {outOfStock ? 'Sin stock' : 'Agregar'}
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
