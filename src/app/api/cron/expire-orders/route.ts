/**
 * GET /api/cron/expire-orders
 * Cancela órdenes pendientes > 30 min y libera inventario.
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

  // Llamar a la RPC que expira órdenes (ahora también devuelve puntos redimidos — fix FLOW3-001).
  const result = await queryOne<any>(`
    SELECT * FROM expire_stale_pending_orders(30)
  `, [])

  console.log(`[cron] expired ${result?.expired_count ?? 0} orders`)

  return NextResponse.json({
    ok: true,
    expired_count: result?.expired_count ?? 0,
    cutoff: result?.cutoff,
    timestamp: new Date().toISOString(),
  })
}
