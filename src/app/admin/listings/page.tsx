import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Package, ShieldCheck, Eye } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCents } from '@/lib/format'
import { getAllListings } from '@/lib/queries/user-listings'
import { VerifyListingButton } from '@/components/admin/verify-listing-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Listings P2P · Admin' }

export default async function AdminListingsPage() {
  await requireAdmin()

  if (!isDbConfigured()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-munay-ink/60">DB no configurada</p>
      </div>
    )
  }

  const listings = await getAllListings()
  const pendingListings = listings.filter((l) => l.status === 'pending')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
          Marketplace P2P
        </h1>
        <p className="mt-2 text-munay-ink/60">
          {listings.length} listings totales ·{' '}
          <span className="font-semibold text-munay-terracota">{pendingListings.length} pendientes</span>
        </p>
      </div>

      {/* Pendientes de verificar */}
      {pendingListings.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-munay-turquesa" aria-hidden />
            Pendientes de verificación
          </h2>
          <div className="grid gap-4">
            {pendingListings.map((listing) => (
              <Card key={listing.id} className="border-munay-terracota-quemado/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <span className="font-semibold">{listing.title}</span>
                      <span className="ml-2 text-xs text-munay-ink/40">por {listing.user_id.slice(0, 8)}…</span>
                    </div>
                    <Badge variant="secondary">
                      <Package className="mr-1 h-3 w-3" aria-hidden />
                      Pendiente
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-4 text-xs text-munay-ink/60">
                    <span className="font-semibold text-munay-ink">{formatCents(listing.price_cents)}</span>
                    <span className="capitalize">{listing.category}</span>
                    <span>Condición: {listing.condition}</span>
                    {listing.size && <span>Talla: {listing.size}</span>}
                    {listing.brand && <span>Marca: {listing.brand}</span>}
                  </div>
                  {listing.description && (
                    <p className="text-xs text-munay-ink/50 line-clamp-2">{listing.description}</p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <VerifyListingButton listingId={listing.id} action="verified">
                      <CheckCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Verificar
                    </VerifyListingButton>
                    <VerifyListingButton listingId={listing.id} action="rejected">
                      <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Rechazar
                    </VerifyListingButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Todos los listings */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Todos los listings</h2>
        {listings.length === 0 ? (
          <Card className="border-dashed border-black/10">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-munay-ink/30" aria-hidden />
              <p className="text-munay-ink/60">No hay listings de usuarios aún.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.filter((l) => l.status !== 'pending').map((listing) => (
              <Card key={listing.id}>
                <CardContent className="flex items-start justify-between gap-2 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{listing.title}</p>
                    <p className="text-xs text-munay-ink/50 mt-1">{formatCents(listing.price_cents)} · {listing.category}</p>
                  </div>
                  <Badge variant={
                    listing.status === 'verified' || listing.status === 'published'
                      ? 'default' : 'outline'
                  } className="shrink-0 text-[10px]">
                    {listing.status === 'verified' && <Eye className="mr-1 h-3 w-3" aria-hidden />}
                    {listing.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
