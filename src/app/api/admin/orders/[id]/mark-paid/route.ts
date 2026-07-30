/**
 * POST /api/admin/orders/[id]/mark-paid
 *
 * Permite al admin marcar manualmente una orden como pagada
 * (cuando el pago se coordina por WhatsApp).
 *
 * Registra qué admin ejecutó la acción (provider_ref incluye adminUserId).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { markOrderPaid } from '@/lib/orders-neon'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  const { id } = await params

  const body: { payment_note?: string } = {}
  try {
    const parsed = await req.json()
    if (parsed.payment_note) body.payment_note = parsed.payment_note
  } catch {
    // Sin body — ok
  }

  // Registrar qué admin marcó como pagada y nota opcional
  const providerRef = `whatsapp-manual-${admin.id}-${Date.now()}`
  const note = body.payment_note ? ` (${body.payment_note})` : ''

  const result = await markOrderPaid(id, `${providerRef}${note}`)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 422 }
    )
  }

  const alreadyPaid = (result as any).alreadyPaid === true

  return NextResponse.json({
    ok: true,
    order_id: id,
    provider_ref: providerRef,
    already_paid: alreadyPaid,
    message: alreadyPaid
      ? 'La orden ya estaba marcada como pagada.'
      : `Orden marcada como pagada correctamente.${note}`,
  })
}
