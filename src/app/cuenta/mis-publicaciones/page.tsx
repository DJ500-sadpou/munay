import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Package, Clock, CheckCircle, XCircle, Eye } from 'lucide-react'
import { currentUser } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'
import { getUserListings } from '@/lib/queries/user-listings'
import { TrustBadge } from '@/components/p2p/trust-badge'
import type { ListingStatus } from '@/types/user-listing'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mis publicaciones · Munay' }

const STATUS_CONFIG: Record<ListingStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  verified: { label: 'Verificado', variant: 'default', icon: CheckCircle },
  published: { label: 'Publicado', variant: 'default', icon: Eye },
  rejected: { label: 'Rechazado', variant: 'destructive', icon: XCircle },
}

export default async function MisPublicacionesPage() {
  const user = await currentUser()
  if (!user) {
    redirect('/sign-in?redirect_url=/cuenta/mis-publicaciones')
  }

  const listings = await getUserListings(user.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
            Mis publicaciones
          </h1>
          <p className="mt-2 text-munay-ink/60">
            {listings.length} {listings.length === 1 ? 'prenda publicada' : 'prendas publicadas'}
          </p>
        </div>
        <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href="/publicar">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Publicar prenda
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Package className="h-12 w-12 text-munay-ink/20" aria-hidden />
            <p className="text-munay-ink/60">Aún no has publicado ninguna prenda.</p>
            <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              <Link href="/publicar">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Publicar mi primera prenda
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const statusConfig = STATUS_CONFIG[listing.status]
            const StatusIcon = statusConfig.icon

            return (
              <Card key={listing.id} className="overflow-hidden">
                <CardHeader className={`pb-3 ${
                  listing.status === 'verified' || listing.status === 'published'
                    ? 'bg-munay-turquesa/[0.03]'
                    : listing.status === 'rejected'
                    ? 'bg-munay-terracota-quemado/[0.03]'
                    : ''
                }`}>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold line-clamp-2">{listing.title}</span>
                    <Badge variant={statusConfig.variant} className="shrink-0">
                      <StatusIcon className="mr-1 h-3 w-3" aria-hidden />
                      {statusConfig.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-lg font-bold text-munay-ink">{formatCents(listing.price_cents)}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-munay-ink/60">
                    <span className="rounded-md bg-munay-crema/20 px-2 py-0.5 capitalize">{listing.category}</span>
                    {listing.size && (
                      <span className="rounded-md bg-munay-crema/20 px-2 py-0.5">Talla {listing.size}</span>
                    )}
                  </div>
                  {listing.status === 'verified' && (
                    <div className="pt-1">
                      <TrustBadge type="verificado" size="sm" />
                    </div>
                  )}
                  {listing.status === 'rejected' && listing.rejection_reason && (
                    <p className="text-xs text-munay-terracota-quemado">
                      Motivo: {listing.rejection_reason}
                    </p>
                  )}
                  <p className="text-[10px] text-munay-ink/40">
                    Publicado el {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
