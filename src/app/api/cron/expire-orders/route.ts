/**
 * GET /api/cron/expire-orders
 * Cancela órdenes pendientes y libera inventario.
 *
 * - Órdenes normales (sin ticket): expiran después de 60 min
 * - Órdenes con ticket (WhatsApp): expiran después de 72h
 *
 * Protegido por CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Fix FLOW3-013: comparación timing-safe del CRON_SECRET.
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no configurado' },
      { status: 503 }
    )
  }

  const expected = `Bearer ${expectedSecret}`
  const actual = authHeader ?? ''
  const ok = actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'DB no configurada' },
      { status: 503 }
    )
  }

  // Usar la nueva RPC v2 que excluye órdenes con ticket (WhatsApp) hasta 72h
  const result = await queryOne<any>(`
    SELECT * FROM expire_stale_orders_v2(60, 72)
  `, [])

  const expiredCount = result?.expired_count ?? 0
  console.log(`[cron] expired ${expiredCount} orders (standard < 60min, whatsapp < 72h)`)

  return NextResponse.json({
    ok: true,
    expired_count: expiredCount,
    cutoff_standard: result?.cutoff_standard,
    cutoff_whatsapp: result?.cutoff_whatsapp,
    timestamp: new Date().toISOString(),
  })
}
