import Link from 'next/link'
import { Tags, ArrowRight, ShoppingBag } from 'lucide-react'
import { listActiveBrands } from '@/lib/queries/brands'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants'

export const metadata = {
  title: 'Marcas · Munay',
  description: 'Explora las prendas de Munay por marca.',
}

// [FIX R4] force-dynamic: sin esto Next prerenderiza estático y congela la
// lista de marcas en build (la página no tiene searchParams).
export const dynamic = 'force-dynamic'

export default async function MarcasPage() {
  const brands = await listActiveBrands()

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
            Marcas
          </h1>
          <p className="mt-2 text-munay-ink/60">
            Elige tu marca favorita y descubre sus prendas en el catálogo.
          </p>
        </div>

        {brands.length === 0 ? (
          /* Empty state coherente con MUNAY */
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white p-12 text-center">
            <Tags className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="font-display text-lg font-semibold text-munay-ink">
              Aún no tenemos marcas destacadas
            </p>
            <p className="max-w-sm text-sm text-munay-ink/60">
              Vuelve pronto. Mientras tanto, explora todo el catálogo.
            </p>
            <Button asChild className="mt-2 bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              <Link href={ROUTES.catalogo}>
                <ShoppingBag className="mr-2 h-4 w-4" aria-hidden />
                Ver catálogo
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <Link key={b.id} href={`${ROUTES.catalogo}?marca=${encodeURIComponent(b.slug)}`}>
                <Card className="group border-black/5 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="font-display text-lg font-semibold text-munay-ink">{b.nombre}</p>
                      <p className="mt-0.5 text-xs text-munay-ink/50">
                        Ver prendas de esta marca
                      </p>
                    </div>
                    <ArrowRight
                      className="h-5 w-5 text-munay-terracota transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
