import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Zap, Package, Search } from 'lucide-react'
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
  description: 'Explora las piezas disponibles en la tienda mística Munay (Ibarra, Ecuador).',
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parseFiltersFromSearchParams(sp)

  // ---- Detección inteligente de código flash en la búsqueda ----
  // Si `q` parece un código flash Y existe en DB, redirigir a /flash/[code]
  // en lugar de mostrar resultados de búsqueda.
  if (filters.q && looksLikeFlashCode(filters.q)) {
    const flash = await getValidFlashCode(filters.q)
    if (flash) {
      redirect(ROUTES.flash(flash.code))
    }
    // Si parece código pero no es válido, mostramos un aviso + búsqueda normal.
  }

  const products = await listProducts(filters)
  const supabaseReady = isSupabaseConfigured()

  // Verificar si hay un flash code activo en los filtros (vía ?flash=)
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
      {/* Header */}
      <div className="mb-6">
        <Badge variant="secondary" className="mb-2">Fase 2 · datos en vivo de Supabase</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Catálogo
        </h1>
        <p className="mt-2 text-muted-foreground">
          Piezas únicas con historia · precios en USD · envíos desde Ibarra.
        </p>
      </div>

      {/* Buscador */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start">
        <CatalogSearch initialValue={filters.q ?? ''} />
        <Button asChild variant="outline" className="sm:w-auto">
          <Link href="/flash">
            <Zap className="mr-2 h-4 w-4" aria-hidden />
            Tengo un código flash
          </Link>
        </Button>
      </div>

      {/* Aviso si el código no es válido */}
      {filters.q && looksLikeFlashCode(filters.q) && !activeFlashInfo && supabaseReady && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="text-foreground">
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

      {/* Aviso si hay código flash activo */}
      {activeFlashInfo && (
        <div className="mb-6 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <p className="text-foreground">
            <Zap className="mr-1 inline h-4 w-4 text-accent" aria-hidden />
            Código <strong className="font-mono">{activeFlashInfo.code}</strong> activo:
            {' '}
            {activeFlashInfo.type === 'discount' && activeFlashInfo.discount_percent != null
              ? `${activeFlashInfo.discount_percent}% de descuento en todas las piezas.`
              : activeFlashInfo.type === 'unlock'
              ? 'Piezas exclusivas desbloqueadas.'
              : 'Descuento aplicado.'}
          </p>
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
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
              {filters.q ? (
                <>
                  <Search className="h-10 w-10 text-muted-foreground" aria-hidden />
                  <p className="text-muted-foreground">
                    No encontramos piezas para <strong>"{filters.q}"</strong>.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/catalogo">Ver todo el catálogo</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
                  <p className="text-muted-foreground">No hay piezas disponibles con esos filtros.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
