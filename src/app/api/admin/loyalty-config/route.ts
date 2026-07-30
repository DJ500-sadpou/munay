/**
 * GET /api/admin/loyalty-config — obtener config actual + stats
 * PUT /api/admin/loyalty-config — actualizar config (enabled, min_discount_percent, max_discount_percent)
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

  let body: { enabled?: boolean; min_discount_percent?: number; max_discount_percent?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const current = await getLoyaltyConfig()

  const enabled = body.enabled ?? current.enabled
  const min_discount_percent = body.min_discount_percent ?? current.min_discount_percent
  const max_discount_percent = body.max_discount_percent ?? current.max_discount_percent

  // Validar rango: min >= 1, max >= min, max <= 99
  if (min_discount_percent < 1 || min_discount_percent > 99) {
    return NextResponse.json(
      { ok: false, error: 'El mínimo debe estar entre 1% y 99%' },
      { status: 400 }
    )
  }
  if (max_discount_percent < 1 || max_discount_percent > 99) {
    return NextResponse.json(
      { ok: false, error: 'El máximo debe estar entre 1% y 99%' },
      { status: 400 }
    )
  }
  if (max_discount_percent < min_discount_percent) {
    return NextResponse.json(
      { ok: false, error: 'El máximo no puede ser menor que el mínimo' },
      { status: 400 }
    )
  }

  const saved = await setLoyaltyConfig({ enabled, min_discount_percent, max_discount_percent })
  if (!saved) {
    return NextResponse.json({ ok: false, error: 'Error guardando config' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: { enabled, min_discount_percent, max_discount_percent } })
}
