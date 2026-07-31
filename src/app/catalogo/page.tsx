import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Zap, Package, Search } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { CatalogSearch } from '@/components/catalogo/catalog-search'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { DbNotConfiguredBanner } from '@/components/catalogo/db-not-configured-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  listProducts,
  parseFiltersFromSearchParams,
  getValidFlashCode,
  looksLikeFlashCode,
} from '@/lib/queries/products'
import { ROUTES } from '@/lib/constants'
import { isDbConfigured } from '@/lib/db/neon'

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
  const dbReady = isDbConfigured()

  // Verificar si hay un flash code activo en los filtros (vía ?flash=)
  // F0/BLOQUE B: los códigos flash son SOLO 'unlock' (desbloqueo de piezas).
  let activeFlashInfo: { code: string; type: string } | null = null
  if (filters.flashCode) {
    const fc = await getValidFlashCode(filters.flashCode)
    if (fc) {
      activeFlashInfo = {
        code: fc.code,
        type: fc.type,
      }
    }
  }

  // Agrupar por condición: nuevos primero, usados después
  // Mystery Box (condition='new') se agrupa como nuevo automáticamente
  const newProducts = products.filter(p => p.condition === 'new')
  const usedProducts = products.filter(p => p.condition === 'used')

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
            Catálogo
          </h1>
          <p className="mt-2 text-munay-ink/60">
            Prendas nuevas y de segunda mano · precios en USD · envíos desde Ibarra.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start">
          <CatalogSearch initialValue={filters.q ?? ''} />
          <Button asChild variant="outline" className="sm:w-auto">
            <Link href="/flash">
              <Zap className="mr-2 h-4 w-4" aria-hidden />
              Tengo un código flash
            </Link>
          </Button>
        </div>

        {filters.q && looksLikeFlashCode(filters.q) && !activeFlashInfo && dbReady && (
          <div className="mb-6 rounded-lg border border-munay-terracota/20 bg-munay-terracota/5 px-4 py-3 text-sm text-munay-ink">
            <strong>{filters.q.toUpperCase()}</strong> no es un código flash válido.
            Mostrando resultados de búsqueda normales.
          </div>
        )}

        {!dbReady && (
          <div className="mb-6">
            <DbNotConfiguredBanner />
          </div>
        )}

        {activeFlashInfo && (
          <div className="mb-6 rounded-lg border border-munay-terracota/15 bg-munay-terracota/5 px-4 py-3 text-sm text-munay-ink">
            <Zap className="mr-1 inline h-4 w-4 text-munay-terracota" aria-hidden />
            Código <strong className="font-mono">{activeFlashInfo.code}</strong> activo:
            {' '}
            Piezas exclusivas desbloqueadas.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <CatalogFilters
            filters={filters}
            totalCount={products.length}
            flashCodeActive={activeFlashInfo?.code ?? null}
          />

          <div className="space-y-8">
            {products.length > 0 ? (<>
              {newProducts.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-munay-ink/40">
                    Nuevo
                    <span className="ml-2 font-normal normal-case text-munay-ink/30">({newProducts.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                    {newProducts.map((p) => (
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
                </section>
              )}
              {usedProducts.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-munay-ink/40">
                    Segunda mano
                    <span className="ml-2 font-normal normal-case text-munay-ink/30">({usedProducts.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                    {usedProducts.map((p) => (
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
                </section>
              )}
            </>) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 py-20 text-center">
                {filters.q ? (
                  <>
                    <Search className="h-10 w-10 text-munay-ink/30" aria-hidden />
                    <p className="text-munay-ink/60">
                      No encontramos piezas para <strong>"{filters.q}"</strong>.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/catalogo">Ver todo el catálogo</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Package className="h-10 w-10 text-munay-ink/30" aria-hidden />
                    <p className="text-munay-ink/60">No hay prendas disponibles con esos filtros.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
