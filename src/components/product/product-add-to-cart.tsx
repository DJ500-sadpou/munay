'use client'

import { useState } from 'react'
import { useCart } from '@/store/cart'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Check, Zap, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import type { ProductCondition, ProductGrading } from '@/types/database'

interface Props {
  product: {
    id: string
    slug: string
    title: string
    description: string | null
    price_cents: number
    condition: ProductCondition
    grading: ProductGrading | null
    stock: number
    flash_discount_percent: number | null
    flash_code: string | null
  }
}

export function ProductAddToCart({ product }: Props) {
  const addItem = useCart((s) => s.addItem)
  const [added, setAdded] = useState(false)

  const outOfStock = product.stock <= 0
  const hasFlash = product.flash_discount_percent != null && product.flash_discount_percent > 0
  const finalPrice = hasFlash
    ? Math.round(product.price_cents * (1 - (product.flash_discount_percent as number) / 100))
    : product.price_cents

  const handleAdd = () => {
    if (outOfStock) return
    addItem({
      id: product.id,
      slug: product.slug,
      title: product.title,
      unit_price_cents: finalPrice,
      condition: product.condition,
      // [BLOQUE B] Llevar el código flash para que createOrder aplique
      // precio_especial_cents de forma autoritativa (server-side).
      flash_code: product.flash_code ?? null,
      // [AUDIT] Precio regular de la línea: el checkout lo usa para replicar
      // la no-acumulación del server (si gana cupón/FID-, los ítems flash
      // vuelven a precio regular). Sin esto el preview muestra un total
      // distinto al que cobra createOrder.
      regular_unit_price_cents: product.price_cents,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Precio con descuento */}
      <div className="flex items-baseline gap-3">
        {hasFlash && (
          <span className="text-lg text-muted-foreground line-through">
            {formatCents(product.price_cents)}
          </span>
        )}
        <span className={`text-3xl font-bold ${hasFlash ? 'text-primary' : 'text-foreground'}`}>
          {formatCents(finalPrice)}
        </span>
        {hasFlash && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
            -{product.flash_discount_percent}%
          </span>
        )}
      </div>

      {/* Stock + botones */}
      <div className="rounded-md border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Disponibilidad</span>
          <span className={outOfStock ? 'text-destructive' : 'text-primary'}>
            {outOfStock ? 'Agotado' : `${product.stock} disponible${product.stock === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            disabled={outOfStock}
            onClick={handleAdd}
          >
            {added ? (
              <>
                <Check className="mr-2 h-4 w-4" aria-hidden />
                Agregado al carrito
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
                {outOfStock ? 'No disponible' : 'Agregar al carrito'}
              </>
            )}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={ROUTES.carrito}>Ir al carrito</Link>
          </Button>
        </div>
      </div>

      {/* Aviso de flash code activo en la sesión */}
      {product.flash_code && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
          <p className="flex items-center gap-2 text-accent-foreground">
            <Zap className="h-4 w-4 text-accent" aria-hidden />
            <span>
              Código <strong className="font-mono">{product.flash_code}</strong> aplicado a esta pieza.
            </span>
          </p>
        </div>
      )}

      {/* CTA para quien no tenga código */}
      {!product.flash_code && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>
              ¿Tienes un código flash?{' '}
              <Link href={ROUTES.catalogo} className="text-primary underline hover:no-underline">
                Búscalo en el catálogo
              </Link>{' '}
              para descubrir piezas exclusivas.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
