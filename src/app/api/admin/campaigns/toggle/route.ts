import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isDbConfigured } from '@/lib/db/neon'
import { toggleCampaign, getCampaignById } from '@/lib/queries/flash-campaigns'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB no configurada' }, { status: 500 })
  }

  try {
    const { campaignId, active } = await req.json()

    if (!campaignId || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    // Defense in depth: verificar inmutabilidad de campañas finalizadas
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }
    if (campaign.status === 'ended') {
      return NextResponse.json(
        { error: 'No se puede reactivar una campaña finalizada. Crea una nueva edición.' },
        { status: 400 }
      )
    }

    const ok = await toggleCampaign(campaignId, active)
    if (!ok) {
      return NextResponse.json({ error: 'Error al actualizar campaña' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Error al actualizar campaña' },
      { status: 500 }
    )
  }
}
