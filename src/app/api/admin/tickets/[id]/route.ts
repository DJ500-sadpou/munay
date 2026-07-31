/**
 * PATCH /api/admin/tickets/[id]
 *
 * Permite al admin cambiar el estado de un ticket:
 *   new → in_progress → completed | cancelled
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { queryOne, isDbConfigured } from '@/lib/db/neon'

export const runtime = 'nodejs'

const VALID_STATUSES = ['new', 'in_progress', 'completed', 'cancelled'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin()

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  const { id } = await params

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as any)) {
    return NextResponse.json(
      { ok: false, error: `Estado inválido. Valores: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Validar transiciones permitidas (backend: evitar que completed→new vía API)
  const current = await queryOne<any>(
    `SELECT status FROM tickets WHERE id = $1`,
    [id]
  )
  if (!current) {
    return NextResponse.json({ ok: false, error: 'Ticket no encontrado' }, { status: 404 })
  }

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    new: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }

  if (!ALLOWED_TRANSITIONS[current.status]?.includes(body.status)) {
    return NextResponse.json(
      { ok: false, error: `No se puede cambiar de ${current.status} a ${body.status}` },
      { status: 422 }
    )
  }

  const result = await queryOne<any>(
    `UPDATE tickets SET status = $1, updated_at = now()
     WHERE id = $2 AND status = $3
     RETURNING id, status, updated_at`,
    [body.status, id, current.status]
  )

  if (!result) {
    return NextResponse.json({ ok: false, error: 'Ticket no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    ticket_id: result.id,
    status: result.status,
    updated_at: result.updated_at,
  })
}
