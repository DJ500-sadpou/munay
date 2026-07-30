import Link from 'next/link'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Zap, Sparkles, ArrowRight, CheckCircle2, XCircle, Clock, Package } from 'lucide-react'
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
      <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <XCircle className="h-12 w-12 text-munay-terracota" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-munay-ink">Código no válido</h1>
        <p className="mt-2 max-w-md text-munay-ink/60">
          El código <code className="rounded bg-munay-cream/30 px-1.5 py-0.5 font-mono">{upper}</code> no existe,
          está inactivo, ya expiró o alcanzó su límite de usos.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
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
    <div className="bg-gradient-to-b from-white via-munay-cream/10 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <Badge className={`mb-3 ${isUnlockType ? 'bg-munay-cream text-munay-ink' : 'bg-munay-terracota text-white'}`}>
          {isUnlockType ? (
            <><Sparkles className="mr-1 h-3 w-3" /> Pieza{products.length !== 1 ? 's' : ''} desbloqueada{products.length !== 1 ? 's' : ''}</>
          ) : (
            <><Zap className="mr-1 h-3 w-3" /> Oferta flash activa</>
          )}
        </Badge>

        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
          Código: <span className="text-munay-terracota">{flash.code}</span>
        </h1>
        <p className="mt-2 text-munay-ink/60">
          {isUnlockType
            ? 'Este código revela piezas exclusivas que no están visibles en el catálogo público.'
            : discountPct > 0
            ? `Descuento del ${discountPct}% en las piezas asociadas a este código.`
            : 'Descuento especial activo en las piezas asociadas.'}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-black/5 bg-white p-3 text-sm shadow-sm">
            <p className="flex items-center gap-2 text-munay-ink/60">
              <Clock className="h-4 w-4" aria-hidden />
              Válido hasta
            </p>
            <p className="mt-1 font-medium text-munay-ink">
              {new Date(flash.ends_at).toLocaleDateString('es-EC', { dateStyle: 'long' })}
            </p>
          </div>
          {flash.remaining_uses !== null && (
            <div className="rounded-lg border border-black/5 bg-white p-3 text-sm shadow-sm">
              <p className="flex items-center gap-2 text-munay-ink/60">
                <Package className="h-4 w-4" aria-hidden />
                Usos restantes
              </p>
              <p className="mt-1 font-medium text-munay-ink">{flash.remaining_uses}</p>
            </div>
          )}
          <div className="rounded-lg border border-black/5 bg-white p-3 text-sm shadow-sm">
            <p className="flex items-center gap-2 text-munay-ink/60">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Estado
            </p>
            <p className="mt-1 font-medium text-munay-terracota">Activo</p>
          </div>
        </div>

        <Separator className="my-8" />

        {products.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-munay-ink">
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
                <Card key={p.id} className="overflow-hidden border-black/5 shadow-sm">
                  <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
                    <div className="relative aspect-square sm:aspect-auto bg-white">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 200px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-munay-ink/30">
                          <Sparkles className="h-10 w-10 opacity-30" aria-hidden />
                        </div>
                      )}
                      {hasDiscount && (
                        <div className="absolute left-2 top-2">
                          <Badge className="bg-munay-terracota text-white">
                            <Zap className="mr-1 h-3 w-3" />−{discountPct}%
                          </Badge>
                        </div>
                      )}
                      {!p.active && (
                        <div className="absolute right-2 top-2">
                          <Badge variant="outline" className="bg-white/80">
                            <Sparkles className="mr-1 h-3 w-3" />Exclusivo
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-col justify-between p-5">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-munay-ink">{p.title}</h3>
                        <p className="mt-2 text-sm text-munay-ink/60 line-clamp-3">
                          {p.description ?? (isUnlockType
                            ? 'Pieza exclusiva desbloqueada con tu código.'
                            : 'Pieza con descuento flash.')}
                        </p>
                        <div className="mt-3 flex items-baseline gap-2">
                          {hasDiscount && (
                            <span className="text-sm text-munay-ink/40 line-through">
                              {formatCents(p.price_cents)}
                            </span>
                          )}
                          <span className="text-2xl font-bold text-munay-terracota">
                            {formatCents(finalPrice)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild size="sm" className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
                          <Link href={`${ROUTES.producto(p.slug)}?flash=${flash.code}`}>
                            Ver detalles
                            <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${ROUTES.catalogo}?flash=${flash.code}`}>
                            <Zap className="mr-1 h-3 w-3" aria-hidden />
                            Ver catálogo con descuento
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
          <Card className="border-dashed border-black/10">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-munay-ink/30" aria-hidden />
              <p className="text-munay-ink/60">
                Este código es válido pero no tiene productos asociados por ahora.
              </p>
              {isDiscountType && (
                <p className="text-xs text-munay-ink/50">
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
