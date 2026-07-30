import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Zap, Package, Search, Sparkles, ArrowRight } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { CatalogSearch } from '@/components/catalogo/catalog-search'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { SupabaseNotConfiguredBanner } from '@/components/catalogo/supabase-not-configured-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  listProducts,
  parseFiltersFromSearchParams,
  getValidFlashCode,
  looksLikeFlashCode,
} from '@/lib/queries/products'
import { ROUTES } from '@/lib/constants'
import { isSupabaseConfigured } from '@/lib/supabase/configured'

export const metadata = {
  title: 'Catálogo',
  description: 'Explora las prendas disponibles en Munay — ropa nueva y de segunda mano en Ibarra, Ecuador.',
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parseFiltersFromSearchParams(sp)

  // ---- Detección inteligente de código flash en la búsqueda ----
  if (filters.q && looksLikeFlashCode(filters.q)) {
    const flash = await getValidFlashCode(filters.q)
    if (flash) {
      redirect(ROUTES.flash(flash.code))
    }
  }

  const products = await listProducts(filters)
  const supabaseReady = isSupabaseConfigured()

  let activeFlashInfo: { code: string; type: string; discount_percent: number | null } | null = null
  if (filters.flashCode) {
    const fc = await getValidFlashCode(filters.flashCode)
    if (fc) {
      activeFlashInfo = {
        code: fc.code,
        type: fc.type,
        discount_percent: fc.discount_percent,
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header con línea decorativa */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Catálogo
          </h1>
          <Badge variant="secondary" className="rounded-full px-3 text-xs font-normal">
            {products.length} {products.length === 1 ? 'prenda' : 'prendas'}
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl">
          Prendas nuevas y de segunda mano, seleccionadas con cuidado.
          Envíos desde Ibarra a todo Ecuador.
        </p>
        <div className="mt-4 h-0.5 w-16 rounded-full bg-gradient-to-r from-primary to-accent" />
      </div>

      {/* Buscador */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start">
        <CatalogSearch initialValue={filters.q ?? ''} />
        <Button asChild variant="outline" className="sm:w-auto group">
          <Link href="/flash">
            <Zap className="mr-2 h-4 w-4 text-accent transition-transform group-hover:scale-110" aria-hidden />
            Tengo un código flash
          </Link>
        </Button>
      </div>

      {/* Aviso si el código no es válido */}
      {filters.q && looksLikeFlashCode(filters.q) && !activeFlashInfo && supabaseReady && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm shadow-sm">
          <p className="text-destructive">
            <strong>{filters.q.toUpperCase()}</strong> no es un código flash válido.
            Mostrando resultados de búsqueda normales.
          </p>
        </div>
      )}

      {/* Banner si Supabase no está configurado */}
      {!supabaseReady && (
        <div className="mb-6">
          <SupabaseNotConfiguredBanner />
        </div>
      )}

      {/* Aviso si hay código flash activo — glassmorphism */}
      {activeFlashInfo && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent px-5 py-4 text-sm shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
              <Zap className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <p className="text-foreground">
              Código <strong className="font-mono text-accent">{activeFlashInfo.code}</strong> activo:
              {' '}
              {activeFlashInfo.type === 'discount' && activeFlashInfo.discount_percent != null
                ? `${activeFlashInfo.discount_percent}% de descuento en todas las piezas.`
                : activeFlashInfo.type === 'unlock'
                ? 'Piezas exclusivas desbloqueadas.'
                : 'Descuento aplicado.'}
            </p>
          </div>
        </div>
      )}

      {/* Layout principal: filtros + grid */}
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <CatalogFilters
          filters={filters}
          totalCount={products.length}
          flashCodeActive={activeFlashInfo?.code ?? null}
        />

        <div>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{
                    id: p.id,
                    slug: p.slug,
                    title: p.title,
                    price_cents: p.price_cents,
                    condition: p.condition,
                    grading: p.grading,
                    image_url: p.image_url,
                    stock: p.stock,
                    flash_discount_percent: p.flash_discount_percent,
                    flash_code: p.flash_code,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/30 py-24 text-center transition-all hover:border-primary/30">
              {filters.q ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5">
                    <Search className="h-8 w-8 text-primary/40" aria-hidden />
                  </div>
                  <div>
                    <p className="text-foreground/80">
                      No encontramos piezas para <strong className="text-primary">"{filters.q}"</strong>.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Intenta con otros términos o explora todo el catálogo.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="group mt-2">
                    <Link href="/catalogo">
                      Ver todo el catálogo
                      <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5">
                    <Sparkles className="h-8 w-8 text-primary/40" aria-hidden />
                  </div>
                  <div>
                    <p className="text-foreground/80">No hay prendas disponibles con esos filtros.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajusta los filtros o vuelve más tarde — siempre estamos renovando nuestro stock.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
