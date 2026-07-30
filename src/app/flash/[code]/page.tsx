import Link from 'next/link'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Zap, Sparkles, ArrowRight, CheckCircle2, XCircle, Clock, Package, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { getValidFlashCode, getUnlockedProductIds } from '@/lib/queries/products'
import { query, isDbConfigured } from '@/lib/db/neon'

export const metadata = { title: 'Oferta flash' }

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function FlashPage({ params }: PageProps) {
  const { code } = await params
  const upper = code.toUpperCase()

  const flash = await getValidFlashCode(upper)

  // ---- Caso: código inválido/expirado/agotado ----
  if (!flash) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <XCircle className="h-12 w-12 text-destructive" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">Código no válido</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          El código <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{upper}</code> no existe,
          está inactivo, ya expiró o alcanzó su límite de usos.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild>
            <Link href={ROUTES.catalogo}>Ver catálogo público</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/flash">Probar otro código</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ---- Buscar productos asociados en flash_code_products ----
  const associatedIds = await getUnlockedProductIds(flash.code)
  let products: Array<{
    id: string
    slug: string
    title: string
    description: string | null
    price_cents: number
    condition: 'new' | 'used'
    grading: string | null
    image_url: string | null
    stock: number
    active: boolean
  }> = []

  if (associatedIds.length > 0 && isDbConfigured()) {
    const rows = await query<any>(`
      SELECT
        p.id, p.slug, p.title, p.description, p.price_cents, p.condition, p.grading, p.active,
        (SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort ASC LIMIT 1) AS image_url,
        COALESCE(i.stock, 0) - COALESCE(i.reserved, 0) AS stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.id = ANY($1::uuid[])
    `, [associatedIds])

    products = rows.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      price_cents: Number(p.price_cents),
      condition: p.condition,
      grading: p.grading,
      image_url: p.image_url,
      stock: Math.max(0, Number(p.stock)),
      active: p.active,
    }))
  }

  // Calcular precio con descuento
  const discountPct = flash.discount_percent ?? 0
  const getDiscountedPrice = (priceCents: number) =>
    discountPct > 0 ? Math.round(priceCents * (1 - discountPct / 100)) : priceCents

  const isDiscountType = flash.type === 'discount'
  const isUnlockType = flash.type === 'unlock'

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <Badge className={`mb-3 ${isUnlockType ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'}`}>
          {isUnlockType ? (
            <><Sparkles className="mr-1 h-3 w-3" /> Pieza{products.length !== 1 ? 's' : ''} desbloqueada{products.length !== 1 ? 's' : ''}</>
          ) : (
            <><Zap className="mr-1 h-3 w-3" /> Oferta flash activa</>
          )}
        </Badge>

        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Código: <span className="text-primary">{flash.code}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isUnlockType
            ? 'Este código revela piezas exclusivas que no están visibles en el catálogo público.'
            : discountPct > 0
            ? `Descuento del ${discountPct}% en las piezas asociadas a este código.`
            : 'Descuento especial activo en las piezas asociadas.'}
        </p>

        {/* Info de validez */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-card p-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden />
              Válido hasta
            </p>
            <p className="mt-1 font-medium">
              {new Date(flash.ends_at).toLocaleDateString('es-EC', { dateStyle: 'long' })}
            </p>
          </div>
          {flash.remaining_uses !== null && (
            <div className="rounded-md border border-border/60 bg-card p-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" aria-hidden />
                Usos restantes
              </p>
              <p className="mt-1 font-medium">{flash.remaining_uses}</p>
            </div>
          )}
          <div className="rounded-md border border-border/60 bg-card p-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Estado
            </p>
            <p className="mt-1 font-medium text-primary">Activo</p>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Productos */}
        {products.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">
                {products.length} {products.length === 1 ? 'pieza disponible' : 'piezas disponibles'}
              </h2>
              <Badge variant="secondary">
                {discountPct > 0 ? `−${discountPct}% descuento` : 'Sin descuento'}
              </Badge>
            </div>

            {products.map((p) => {
              const finalPrice = getDiscountedPrice(p.price_cents)
              const hasDiscount = finalPrice !== p.price_cents
              return (
                <Card key={p.id} className="overflow-hidden border-primary/30">
                  <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
                    <div className="relative aspect-square sm:aspect-auto bg-muted">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 200px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Sparkles className="h-10 w-10 opacity-30" aria-hidden />
                        </div>
                      )}
                      {/* Badge de descuento */}
                      {hasDiscount && (
                        <div className="absolute left-2 top-2">
                          <Badge className="bg-accent text-accent-foreground">
                            <Zap className="mr-1 h-3 w-3" />−{discountPct}%
                          </Badge>
                        </div>
                      )}
                      {!p.active && (
                        <div className="absolute right-2 top-2">
                          <Badge variant="outline" className="bg-background/80">
                            <Sparkles className="mr-1 h-3 w-3" />Exclusivo
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-col justify-between p-5">
                      <div>
                        <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {p.description ?? (isUnlockType
                            ? 'Pieza exclusiva desbloqueada con tu código.'
                            : 'Pieza con descuento flash.')}
                        </p>
                        <div className="mt-3 flex items-baseline gap-2">
                          {hasDiscount && (
                            <span className="text-sm text-muted-foreground line-through">
                              {formatCents(p.price_cents)}
                            </span>
                          )}
                          <span className="text-2xl font-bold text-primary">
                            {formatCents(finalPrice)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href={`${ROUTES.producto(p.slug)}?flash=${flash.code}`}>
                            Ver detalles
                            <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${ROUTES.carrito}?add=${p.id}&flash=${flash.code}`}>
                            <ShoppingCart className="mr-1 h-3 w-3" aria-hidden />
                            Agregar al carrito
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">
                Este código es válido pero no tiene productos asociados por ahora.
              </p>
              {isDiscountType && (
                <p className="text-xs text-muted-foreground">
                  El administrador debe asociar productos a este código desde el panel admin.
                </p>
              )}
              <Button asChild variant="outline">
                <Link href={ROUTES.catalogo}>Ver catálogo público</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
