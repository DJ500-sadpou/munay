/**
 * GET /api/admin/loyalty-config — obtener config actual + stats
 * PUT /api/admin/loyalty-config — actualizar config (enabled, discount_percent)
 *
 * Protegido por requireAdmin (verifica sesión Clerk + tabla admins).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getLoyaltyConfig, setLoyaltyConfig, getLoyaltyStats } from '@/lib/queries/loyalty-coupons'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const [config, stats] = await Promise.all([getLoyaltyConfig(), getLoyaltyStats()])

  return NextResponse.json({ ok: true, config, stats })
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: { enabled?: boolean; discount_percent?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const current = await getLoyaltyConfig()

  const enabled = body.enabled ?? current.enabled
  const discount_percent = body.discount_percent ?? current.discount_percent

  // Validar rango 20-30%
  if (discount_percent < 20 || discount_percent > 30) {
    return NextResponse.json(
      { ok: false, error: 'El descuento debe estar entre 20% y 30%' },
      { status: 400 }
    )
  }

  const saved = await setLoyaltyConfig({ enabled, discount_percent })
  if (!saved) {
    return NextResponse.json({ ok: false, error: 'Error guardando config' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: { enabled, discount_percent } })
}
