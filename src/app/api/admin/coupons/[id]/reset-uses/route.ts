/**
 * POST /api/admin/coupons/[id]/reset-uses
 *
 * [FIX #15] Resetea el contador de usos de un cupón a 0 y limpia los
 * registros de consumo (coupon_usages) de forma atómica.
 *
 * Protegido por auth() + checkAdminRow (patrón del proyecto).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { resetCouponUses } from '@/lib/queries/coupons'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function checkAdmin() {
  if (!isDbConfigured()) {
    return { ok: false, response: NextResponse.json({ error: 'DB no configurada' }, { status: 503 }) }
  }
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { id } = await ctx.params
  const result = await resetCouponUses(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Error al resetear usos' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
