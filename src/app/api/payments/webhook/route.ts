/**
 * POST /api/payments/webhook
 *
 * Recibe la confirmación asíncrona de la pasarela (Kushki/PayPhone/PayPal).
 *
 * Migrado a Neon Postgres. Arregla hallazgos de auditoría:
 *   - FLOW-002/PERM-003/CODE-006: verificación HMAC real.
 *   - FLOW-010: usa refund_order RPC en lugar de UPDATE directo.
 *   - FLOW-011: pasa monto del webhook a markOrderPaid.
 *   - CODE-007: mergea raw en lugar de sobrescribir.
 *
 * Seguridad:
 *   - Sin auth (la pasarela no tiene sesión).
 *   - Firma verificada por HMAC-SHA256 real (timingSafeEqual).
 *   - Idempotente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { markOrderPaid, markOrderCancelled } from '@/lib/orders-neon'
import { sendRefundEmail } from '@/lib/email/brevo'
import {
  verifyKushkiWebhookSignature,
  parseKushkiWebhook,
  detectPaymentMode,
} from '@/lib/payments/kushki'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'DB no configurada' },
      { status: 503 }
    )
  }

  // 1. Leer body crudo
  const rawBody = await req.text()
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON inválido' },
      { status: 400 }
    )
  }

  // 2. Verificar firma HMAC REAL.
  // Header Kushki oficial: "X-Kushki-Signature" (case-insensitive en Node).
  // Formato Kushki: "<timestamp>.<HMAC-SHA256(secret, timestamp + body)>"
  // Doc: https://docs.kushki.com/cl/notifications/overview
  const signatureHeader =
    req.headers.get('x-kushki-signature') ??
    req.headers.get('x-kushki-id') ??
    req.headers.get('x-signature')

  const webhookSecret = process.env.KUSHKI_WEBHOOK_SECRET

  // Fix CRIT-2: en producción, siempre exigir firma.
  // En desarrollo local (NODE_ENV=development), permitir sin firma solo si modo demo.
  const isLocalDev = process.env.NODE_ENV === 'development'
  const isDemo = detectPaymentMode() === 'demo'

  if (!webhookSecret) {
    if (isLocalDev && isDemo) {
      // Modo dev local sin pasarela real: bypass solo en local.
      console.warn('[webhook] Modo dev: bypass firma (no configurar en prod)')
    } else {
      return NextResponse.json(
        { ok: false, error: 'KUSHKI_WEBHOOK_SECRET no configurado' },
        { status: 503 }
      )
    }
  } else if (!verifyKushkiWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    console.warn('[webhook] Firma inválida — rechazando')
    return NextResponse.json(
      { ok: false, error: 'Firma inválida' },
      { status: 401 }
    )
  }

  // 3. Parsear
  const parsed = parseKushkiWebhook(body)
  if (!parsed.valid) {
    console.warn('[webhook] Body inválido:', parsed.reason)
    return NextResponse.json(
      { ok: false, error: parsed.reason ?? 'Body inválido' },
      { status: 400 }
    )
  }

  const { order_id, provider_ref, status, raw } = parsed
  // parsed.valid === true garantiza order_id y provider_ref existen.
  const oid = order_id!
  const pr = provider_ref!

  console.log(`[webhook] Recibido: order=${oid} status=${status} ref=${pr}`)

  // 4. Buscar la orden (lock para idempotencia)
  const order = await queryOne<any>(`SELECT id, status FROM orders WHERE id = $1`, [oid])
  if (!order) {
    console.warn(`[webhook] Orden no encontrada: ${oid}`)
    return NextResponse.json(
      { ok: false, error: 'Orden no encontrada' },
      { status: 404 }
    )
  }

  // 5. Idempotencia
  if (order.status === 'paid' && status === 'captured') {
    return NextResponse.json({ ok: true, message: 'Ya estaba pagada' })
  }
  if (order.status === 'cancelled' && status === 'failed') {
    return NextResponse.json({ ok: true, message: 'Ya estaba cancelada' })
  }
  if (order.status === 'refunded' && status === 'refunded') {
    return NextResponse.json({ ok: true, message: 'Ya estaba reembolsada' })
  }

  // 6. Aplicar transición
  try {
    if (status === 'captured' && provider_ref) {
      // Pasar monto del webhook para verificación (FLOW-011)
      const paidCents = (raw as any)?.amount?.total
        ? Math.round(Number((raw as any).amount.total) * 100)
        : undefined

      const r = await markOrderPaid(oid, pr, paidCents)
      if (!r.ok) {
        console.error('[webhook] markOrderPaid falló:', r.error)
        return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
      }
      // Fix FLOW3-010: loguear warning de award_points si ocurrió
      if (r.pointsWarning) {
        console.error('[webhook] award_points falló (orden pagada pero sin puntos):', r.pointsWarning)
      }
      console.log(`[webhook] Orden ${oid} marcada como PAID`)
    } else if (status === 'failed') {
      const r = await markOrderCancelled(oid, 'webhook: payment failed')
      if (!r.ok) {
        console.error('[webhook] markOrderCancelled falló:', r.error)
        return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
      }
      console.log(`[webhook] Orden ${oid} marcada como CANCELLED`)
    } else if (status === 'refunded') {
      // Arreglo FLOW-010: usar refund_order RPC en lugar de UPDATE directo
      const refundResult = await queryOne<any>(
        `SELECT * FROM refund_order($1, $2)`,
        [oid, 'webhook: refunded by provider']
      )
      if (!refundResult?.ok) {
        console.error('[webhook] refund_order falló:', refundResult?.reason)
        return NextResponse.json(
          { ok: false, error: refundResult?.reason ?? 'reembolso falló' },
          { status: 500 }
        )
      }
      console.log(`[webhook] Orden ${oid} marcada como REFUNDED`)

      // Enviar email de reembolso (fire-and-forget)
      try {
        const orderData = await queryOne<any>(`
          SELECT customer_email, customer_name, total_cents, points_redeemed
          FROM orders WHERE id = $1
        `, [oid])
        if (orderData) {
          sendRefundEmail({
            orderId: oid,
            customerEmail: orderData.customer_email,
            customerName: orderData.customer_name,
            total_cents: Number(orderData.total_cents),
            points_reverted: Math.floor(Number(orderData.total_cents) / 100),
            points_returned: Number(orderData.points_redeemed),
            reason: 'Reembolso procesado por la pasarela de pago',
          }).catch((err) => {
            console.warn('[webhook] Email reembolso falló (no bloqueante):', err?.message)
          })
        }
      } catch (emailErr: any) {
        console.warn('[webhook] Error obteniendo datos para email:', emailErr?.message)
      }
    } else if (status === 'authorized') {
      console.log(`[webhook] Orden ${order_id} autorizada, esperando captura`)
    }

    // Mergear raw (arreglo CODE-007): no sobrescribir
    const existingPayment = await queryOne<any>(
      `SELECT raw FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [oid]
    )
    const existingRaw = existingPayment?.raw ?? {}
    await query(
      `UPDATE payments SET raw = $1 WHERE order_id = $2`,
      [JSON.stringify({ ...existingRaw, webhook: raw, webhook_received_at: new Date().toISOString() }), oid]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[webhook] Error inesperado:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno en webhook' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/webhook
 * Health check.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/payments/webhook',
    provider: process.env.PAYMENT_PROVIDER ?? 'kushki',
    mode: detectPaymentMode(),
  })
}
