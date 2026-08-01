/**
 * PATCH /api/admin/tickets/[id]
 *
 * Permite al admin cambiar el estado de un ticket:
 *   Soporte: new → in_progress → completed | cancelled
 *   Pedido:  pendiente → confirmado | cancelled
 *
 * [F3.5] 'confirmado' SIEMPRE marca la orden asociada como paid
 * (fuente única de "primera compra" — el plan Ronda 1 exige que la
 * acción Confirmar marque la orden paid incondicionalmente).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { markOrderPaid } from '@/lib/orders-neon'

export const runtime = 'nodejs'

const VALID_STATUSES = ['new', 'in_progress', 'completed', 'cancelled', 'pendiente', 'expirado', 'confirmado'] as const

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
    // [F3.5] Pedido: solo pendiente → confirmado (o cancelado).
    pendiente: ['confirmado', 'cancelled'],
    expirado: [],
    confirmado: [],
  }

  if (!ALLOWED_TRANSITIONS[current.status]?.includes(body.status)) {
    return NextResponse.json(
      { ok: false, error: `No se puede cambiar de ${current.status} a ${body.status}` },
      { status: 422 }
    )
  }

  // [F3.5] Si confirmamos, el ticket DEBE tener order_id (es un ticket de
  // pedido). Los tickets de soporte no usan confirmado.
  if (body.status === 'confirmado') {
    const ticketRow = await queryOne<any>(
      `SELECT order_id, ticket_numero FROM tickets WHERE id = $1`,
      [id]
    )
    if (!ticketRow?.order_id) {
      return NextResponse.json(
        { ok: false, error: 'Este ticket no tiene orden asociada (solo los tickets de pedido se confirman)' },
        { status: 422 }
      )
    }
    const orderId = ticketRow.order_id
    const ticketNumero = ticketRow.ticket_numero

    // Reutilizar markOrderPaid: marca la orden paid, libera inventario,
    // otorga puntos y genera cupón de fidelidad. provider_ref sintético
    // `whatsapp-manual-<ticket>` — payments.provider_ref es text (sin límite
    // de largo explícito en 00002/neon_schema), seguro. Órdenes guest: sin
    // user_id → generateLoyaltyCoupon se omite internamente.
    const paid = await markOrderPaid(orderId, `whatsapp-manual-<ticket>${ticketNumero ?? ''}`)
    if (!paid.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo marcar la orden como pagada: ${paid.error ?? 'error desconocido'}` },
        { status: 422 }
      )
    }
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
    order_marked_paid: body.status === 'confirmado',
    updated_at: result.updated_at,
  })
}
