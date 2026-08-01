/**
 * GET /api/admin/tickets
 * Lista todos los tickets para el panel admin.
 *
 * GET /api/admin/tickets?status=new&limit=50
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, isDbConfigured } from '@/lib/db/neon'
import { getSetting } from '@/lib/queries/settings'
import { SETTINGS_DEFAULTS } from '@/lib/constants'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await requireAdmin()

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)

  // [F3.5] Whitelist ampliada con columnas de pedido (00023).
  const VALID_STATUSES = ['new', 'in_progress', 'completed', 'cancelled', 'pendiente', 'expirado', 'confirmado']

  let sql = `SELECT id, order_id, name, email, phone, message, items, status,
                    ticket_numero, clerk_user_id, precio_total_cents, descuento_aplicado, fecha_expiracion,
                    created_at, updated_at
             FROM tickets`
  const params: any[] = []

  if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    params.push(statusFilter)
    sql += ` WHERE status = $1`
  }

  sql += ` ORDER BY created_at DESC LIMIT ${params.length > 0 ? `$${params.length + 1}` : '$1'}`

  const rows = await query<any>(sql, [...params, limit])

  // [F3.5] El GET también devuelve el toggle para inicializar la vista admin.
  const autoExpireTickets = (await getSetting(
    'auto_expire_tickets_enabled',
    String(SETTINGS_DEFAULTS.auto_expire_tickets_enabled)
  )) !== 'false'

  return NextResponse.json({
    ok: true,
    tickets: rows.map((r: any) => ({
      id: r.id,
      order_id: r.order_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      message: r.message,
      items: r.items,
      status: r.status,
      ticket_numero: r.ticket_numero !== null && r.ticket_numero !== undefined
        ? Number(r.ticket_numero)
        : null,
      clerk_user_id: r.clerk_user_id,
      precio_total_cents: r.precio_total_cents !== null && r.precio_total_cents !== undefined
        ? Number(r.precio_total_cents)
        : null,
      descuento_aplicado: r.descuento_aplicado,
      fecha_expiracion: r.fecha_expiracion,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: rows.length,
    auto_expire_tickets_enabled: autoExpireTickets,
  })
}
