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
import {
  getValidFlashCode,
  getUnlockedProductIds,
  getProductBySlug,
  applyFlashDiscount,
} from '@/lib/queries/products'
import { createServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/configured'
import { SupabaseNotConfiguredBanner } from '@/components/catalogo/supabase-not-configured-banner'

export const metadata = {
  title: 'Oferta flash',
}

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function FlashPage({ params }: PageProps) {
  const { code } = await params
  const upper = code.toUpperCase()

  const flash = await getValidFlashCode(upper)

  // ---- Caso 0: Supabase no configurado ----
  if (!isSupabaseConfigured()) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Badge className="mb-3" variant="secondary">
            <Zap className="mr-1 h-3 w-3" aria-hidden />
            Oferta flash
          </Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Código: <span className="text-primary">{upper}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Para validar este código y mostrar la oferta correspondiente,
            necesitas configurar Supabase.
          </p>
          <div className="mt-6">
            <SupabaseNotConfiguredBanner />
          </div>
        </div>
      </div>
    )
  }

  // ---- Caso 1: código inválido/expirado/agotado ----
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

  // ---- Caso 2: código type='discount' (descuento sobre todo el catálogo) ----
  if (flash.type === 'discount') {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Badge className="mb-3 bg-accent text-accent-foreground">
            <Zap className="mr-1 h-3 w-3" aria-hidden />
            Oferta flash activa
          </Badge>

          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Código: <span className="text-primary">{flash.code}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            {flash.discount_percent != null
              ? `Descuento del ${flash.discount_percent}% sobre todas las piezas del catálogo.`
              : flash.discount_cents != null
              ? `Descuento de ${formatCents(flash.discount_cents)} sobre cada pieza.`
              : 'Descuento especial activo.'}
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

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <Sparkles className="h-10 w-10 text-primary" aria-hidden />
              <h2 className="font-display text-2xl font-semibold">¿Cómo usar este código?</h2>
              <p className="max-w-xl text-muted-foreground">
                Visita el catálogo y verás los precios ya descontados. El descuento se aplicará
                automáticamente al carrito al finalizar la compra.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link href={`${ROUTES.catalogo}?flash=${flash.code}`}>
                    Ver catálogo con descuento
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={ROUTES.carrito}>Ir al carrito</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Caso 3: código type='unlock' (revelar piezas ocultas específicas) ----
  // Traer los productos asociados a este código.
  const unlockedIds = await getUnlockedProductIds(flash.code)
  let unlockedProducts: Array<{
    id: string
    slug: string
    title: string
    description: string | null
    price_cents: number
    condition: 'new' | 'used'
    grading: 'excelente' | 'buena' | 'regular' | null
    image_url: string | null
    stock: number
  }> = []

  if (unlockedIds.length > 0 && isSupabaseConfigured()) {
    // Fix CRIT-4 / PERM2-006: query directa Neon con WHERE p.id = ANY($1::uuid[]).
    // Trae productos active=false (ocultos) ya que es un código de desbloqueo válido.
    const { query } = await import('@/lib/db/neon')
    const rows = await query<any>(`
      SELECT
        p.id, p.slug, p.title, p.description, p.price_cents, p.condition, p.grading,
        (SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort ASC LIMIT 1) AS image_url,
        COALESCE(i.stock, 0) - COALESCE(i.reserved, 0) AS stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.id = ANY($1::uuid[])
    `, [unlockedIds])

    unlockedProducts = rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      price_cents: Number(p.price_cents),
      condition: p.condition,
      grading: p.grading,
      image_url: p.image_url,
      stock: Math.max(0, Number(p.stock)),
    }))
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Badge className="mb-3 bg-accent text-accent-foreground">
          <Sparkles className="mr-1 h-3 w-3" aria-hidden />
          Pieza desbloqueada
        </Badge>

        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Código: <span className="text-primary">{flash.code}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Este código revela piezas exclusivas que no están visibles en el catálogo público.
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

        {/* Productos desbloqueados */}
        {unlockedProducts.length > 0 ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-semibold">
              {unlockedProducts.length} {unlockedProducts.length === 1 ? 'pieza disponible' : 'piezas disponibles'}
            </h2>
            {unlockedProducts.map((p) => (
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
                  </div>
                  <CardContent className="flex flex-col justify-between p-5">
                    <div>
                      <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                        {p.description ?? 'Pieza exclusiva desbloqueada con tu código.'}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-primary">
                        {formatCents(p.price_cents)}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`${ROUTES.producto(p.slug)}?flash=${flash.code}`}>
                          Ver detalles
                          <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={ROUTES.carrito}>Ir al carrito</Link>
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">
                Este código es válido pero no tiene productos asociados visibles por ahora.
              </p>
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
