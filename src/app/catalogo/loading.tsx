import { Loader2 } from 'lucide-react'

/**
 * [P0a] Loading state del catálogo (streaming de la Server Component).
 * Evita el flash de "server error" durante la búsqueda: mientras la query
 * de Neon corre, el usuario ve un skeleton coherente con el layout real.
 */
export default function CatalogoLoading() {
  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        {/* Título + subtítulo skeleton */}
        <div className="h-9 w-40 animate-pulse rounded bg-munay-ink/10" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-munay-ink/10" />

        {/* Barra de búsqueda skeleton */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="h-10 flex-1 animate-pulse rounded-md bg-munay-ink/10" />
          <div className="h-10 w-40 animate-pulse rounded-md bg-munay-ink/10" />
        </div>

        {/* Grilla skeleton */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          <div className="hidden space-y-4 lg:block">
            <div className="h-4 w-24 animate-pulse rounded bg-munay-ink/10" />
            <div className="h-8 animate-pulse rounded bg-munay-ink/10" />
            <div className="h-8 animate-pulse rounded bg-munay-ink/10" />
            <div className="h-8 animate-pulse rounded bg-munay-ink/10" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-lg bg-munay-ink/10"
              />
            ))}
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-munay-ink/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Cargando catálogo…
        </p>
      </div>
    </div>
  )
}
