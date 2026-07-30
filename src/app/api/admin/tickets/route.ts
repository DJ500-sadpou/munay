/**
 * GET /api/admin/tickets
 * Lista todos los tickets para el panel admin.
 *
 * GET /api/admin/tickets?status=new&limit=50
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, isDbConfigured } from '@/lib/db/neon'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await requireAdmin()

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)

  let sql = `SELECT id, order_id, name, email, phone, message, items, status, created_at, updated_at
             FROM tickets`
  const params: any[] = []

  if (statusFilter && ['new', 'in_progress', 'completed', 'cancelled'].includes(statusFilter)) {
    params.push(statusFilter)
    sql += ` WHERE status = $1`
  }

  sql += ` ORDER BY created_at DESC LIMIT ${params.length > 0 ? `$${params.length + 1}` : '$1'}`

  const rows = await query<any>(sql, [...params, limit])

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
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: rows.length,
  })
}
