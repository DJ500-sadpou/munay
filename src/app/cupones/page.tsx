import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { currentUser } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'
import { getActiveCouponsForUser, type Coupon } from '@/lib/queries/coupons'
import { CuponesClient } from '@/components/cupones/cupones-client'

export const metadata = { title: 'Mis cupones' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * [P2b] /cupones — "Mis cupones": página dedicada (independiente de la
 * landing y de los códigos flash). Muestra los cupones activos del usuario
 * (general + primera_compra según historial), permite agregar/redimir un
 * código nuevo y usar un cupón (vuelve a checkout si vino desde allí).
 *
 * Server Component: obtiene userId/email de currentUser() (nunca del cliente)
 * y filtra primera_compra server-side.
 */
export default async function CuponesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  // [FIX Ronda 3] Hardening open-redirect: además de bloquear '//' (redirect
  // protocol-relativo), se bloquea el backslash inicial ('/\\evil.com' se
  // normaliza a '//evil.com' según la spec de URL).
  const returnTo =
    typeof sp.returnTo === 'string' &&
    sp.returnTo.startsWith('/') &&
    !sp.returnTo.startsWith('//') &&
    !sp.returnTo.startsWith('/\\')
      ? sp.returnTo
      : undefined

  let coupons: Coupon[] = []
  let dbError = false
  try {
    const user = await currentUser()
    coupons = await getActiveCouponsForUser(
      user?.id ?? null,
      user?.emailAddresses?.[0]?.emailAddress ?? null
    )
  } catch (err: any) {
    // Nunca exponer stack traces al usuario; estado amigable con reintentar.
    console.warn('[cupones] error cargando cupones:', err?.message)
    dbError = true
  }

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href={returnTo ?? '/'}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Volver
          </Link>
        </Button>

        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
          Mis cupones
        </h1>
        <p className="mt-2 text-munay-ink/60">
          Úsalos en tus compras y ahorra más.
        </p>

        <div className="mt-8">
          <CuponesClient coupons={coupons} returnTo={returnTo} dbError={dbError} />
        </div>
      </div>
    </div>
  )
}
