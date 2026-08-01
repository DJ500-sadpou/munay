import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Zap, Package, Search, AlertTriangle } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { CatalogSearch } from '@/components/catalogo/catalog-search'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { FlashHelpDialog } from '@/components/catalogo/flash-help-dialog'
import { DbNotConfiguredBanner } from '@/components/catalogo/db-not-configured-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  type ProductListItem,
  type FlashCodeInfo,
  listProducts,
  parseFiltersFromSearchParams,
  getValidFlashCode,
  looksLikeFlashCode,
} from '@/lib/queries/products'
import { ROUTES } from '@/lib/constants'
import { isDbConfigured } from '@/lib/db/neon'
import { formatDate } from '@/lib/format'

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

  // [P0a] Estado de error de búsqueda: cualquier excepción de Neon se captura
  // AQUÍ (nunca se expone un stack trace al usuario) y se muestra un mensaje
  // amigable + reintentar, en vez del error genérico de Next.js.
  let searchError = false
  // [FIX Ronda 1] Tipo directo (ProductListItem ya se re-exporta desde
  // products.ts) en vez de Awaited<ReturnType<typeof listProducts>>.
  let products: ProductListItem[] = []
  // [P1] Tipo completo FlashCodeInfo: el banner muestra vigencia (ends_at)
  // y usos restantes (remaining_uses) además del código.
  let activeFlashInfo: FlashCodeInfo | null = null

  // [P0a] Detección de código flash FUERA del try/catch: redirect() lanza
  // NEXT_REDIRECT (un error especial que Next.js maneja). Si se capturara
  // aquí, la redirección de códigos flash se rompería. getValidFlashCode ya
  // no lanza (try/catch interno → null), así que este bloque es seguro.
  // [F2.2] Si `q` parece un código flash Y existe en DB, redirigir a
  // /catalogo?flash=CODE para FILTRAR en la misma página (en vez de
  // redirigir a /flash/[code]): el catálogo muestra únicamente los
  // productos desbloqueados por ese código.
  if (filters.q && looksLikeFlashCode(filters.q)) {
    const flash = await getValidFlashCode(filters.q)
    if (flash) {
      // [FIX Ronda 1] Usar ROUTES.catalogo (mantiene el import usado y el estilo del repo).
      redirect(`${ROUTES.catalogo}?flash=${encodeURIComponent(flash.code)}`)
    }
    // Si parece código pero no es válido, mostramos un aviso + búsqueda normal.
  }

  try {
    products = await listProducts(filters)

    // Verificar si hay un flash code activo en los filtros (vía ?flash=)
    // F0/BLOQUE B: los códigos flash son SOLO 'unlock' (desbloqueo de piezas).
    if (filters.flashCode) {
      activeFlashInfo = await getValidFlashCode(filters.flashCode)
    }
  } catch (err) {
    console.error('[catalogo] error de búsqueda:', err)
    searchError = true
  }

  const dbReady = isDbConfigured()

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
          {/* [F2.2] La barra lee su valor inicial del param `flash` (si hay un
              código activo, se muestra) o de `q` (búsqueda normal). */}
          <CatalogSearch initialValue={filters.flashCode ?? filters.q ?? ''} />
          {/* [F2.3] El botón "Tengo un código flash" ahora abre el modal
              explicativo en lugar de redirigir a /flash. */}
          <FlashHelpDialog />
        </div>

        {!searchError && filters.q && looksLikeFlashCode(filters.q) && !activeFlashInfo && dbReady && (
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

        {/* [P0a] Error state — nunca el error genérico de Next.js */}
        {searchError && (
          <div className="mb-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="font-medium text-munay-ink">No pudimos realizar la búsqueda.</p>
            <p className="text-sm text-munay-ink/60">Inténtalo nuevamente.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`${ROUTES.catalogo}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}`}>
                Reintentar
              </Link>
            </Button>
          </div>
        )}

        {activeFlashInfo && (
          <div className="mb-6 rounded-lg border border-munay-terracota/15 bg-munay-terracota/5 px-4 py-3 text-sm text-munay-ink">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <Zap className="mr-1 inline h-4 w-4 text-munay-terracota" aria-hidden />
                Código <strong className="font-mono">{activeFlashInfo.code}</strong> activo:
                {' '}
                piezas exclusivas desbloqueadas.
              </span>
              {/* [P1] Vigencia del código flash (vence fecha/hora) */}
              <span className="text-xs text-munay-ink/60">
                Vence el {formatDate(activeFlashInfo.ends_at)}
              </span>
              {/* [P1] Usos restantes (null → ilimitado) */}
              {activeFlashInfo.remaining_uses !== null && (
                <span className="text-xs text-munay-ink/60">
                  Usos restantes: {activeFlashInfo.remaining_uses}
                </span>
              )}
            </div>
          </div>
        )}

        {/* [F2.2] Badge "Código Flash aplicado ⚡" — se muestra con el filtro
            activo para que el usuario vea que está viendo SOLO esas piezas. */}
        {activeFlashInfo && (
          <div className="mb-4 flex items-center gap-2">
            <Badge className="bg-munay-terracota text-white border-transparent">
              <Zap className="mr-1 h-3 w-3" aria-hidden />
              Código Flash aplicado ⚡
            </Badge>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-munay-ink/60"
            >
              <Link href="/catalogo">Quitar filtro</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <CatalogFilters
            filters={filters}
            totalCount={products.length}
            flashCodeActive={activeFlashInfo?.code ?? null}
          />

          <div className="space-y-8">
            {searchError ? null : products.length > 0 ? (<>
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
                    <p className="font-display text-lg font-semibold text-munay-ink">
                      No encontramos resultados
                    </p>
                    <p className="max-w-sm text-sm text-munay-ink/60">
                      Prueba con otra prenda, marca o categoría.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/catalogo">Limpiar búsqueda</Link>
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
