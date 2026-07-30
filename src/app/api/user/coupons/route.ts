/**
 * GET /api/user/coupons
 * Retorna los cupones de fidelidad activos del usuario logueado.
 *
 * También retorna la config actual (enabled, discount_percent)
 * para que el checkout pueda mostrar/ocultar la sección.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveUserCoupons, getLoyaltyConfig } from '@/lib/queries/loyalty-coupons'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ ok: false, coupons: [], error: 'not_authenticated' }, { status: 401 })
  }

  const [config, coupons] = await Promise.all([getLoyaltyConfig(), getActiveUserCoupons(userId)])

  return NextResponse.json({
    ok: true,
    coupons,
    config: {
      enabled: config.enabled,
      min_discount_percent: config.min_discount_percent,
      max_discount_percent: config.max_discount_percent,
    },
  })
}
