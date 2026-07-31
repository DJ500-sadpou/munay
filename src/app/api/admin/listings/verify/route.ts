import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isDbConfigured } from '@/lib/db/neon'
import { updateListingStatus, getListingById } from '@/lib/queries/user-listings'
import type { ListingStatus } from '@/types/user-listing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'DB no configurada' }, { status: 500 })
    }

    const body = await req.json()
    const { listingId, status, rejectionReason } = body

    if (!listingId || !status) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    if (!['verified', 'rejected', 'published'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const listing = await getListingById(listingId)
    if (!listing) {
      return NextResponse.json({ error: 'Listing no encontrado' }, { status: 404 })
    }

    const ok = await updateListingStatus(
      listingId,
      status as ListingStatus,
      admin.id,
      rejectionReason
    )

    if (!ok) {
      return NextResponse.json({ error: 'Error al actualizar listing' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/admin/listings/verify] Error:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
