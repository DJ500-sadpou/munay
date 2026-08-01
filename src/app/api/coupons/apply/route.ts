/**
 * POST /api/coupons/apply
 *
 * Valida un cupón de descuento (tabla `coupons`) contra el subtotal
 * del checkout. NO consume el cupón — el consumo real ocurre dentro
 * de la transacción de createOrder (para no gastar el cupón si el
 * usuario abandona el checkout).
 *
 * Respeta: activo, fechas, usos_máximos, monto_mínimo y tipo
 * (primera_compra).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { validateCoupon, normalizeCouponCode, toPublicCoupon } from '@/lib/queries/coupons'

export const runtime = 'nodejs'

// [FIX Ronda 2] Rate limiter simple en memoria: el endpoint valida códigos
// de forma pública; sin límite permitiría enumerar cupones válidos.
// Mismo patrón que /api/checkout/whatsapp.
const ipTimestamps = new Map<string, number>()
const RATE_LIMIT_MS = 10_000 // 10 segundos entre intentos por IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const last = ipTimestamps.get(ip)
  if (last && now - last < RATE_LIMIT_MS) return false
  ipTimestamps.set(ip, now)
  if (ipTimestamps.size > 100) {
    const cutoff = now - RATE_LIMIT_MS
    for (const [key, ts] of ipTimestamps) {
      if (ts < cutoff) ipTimestamps.delete(key)
    }
  }
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Intenta en unos segundos.', error_code: 'rate_limited' },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const codigo = typeof body.codigo === 'string' ? body.codigo : ''
  const subtotalCents = Number(body.subtotal_cents ?? 0)
  const customerEmail = typeof body.customer_email === 'string' ? body.customer_email : ''
  // [P2b] /cupones usa ignorar_minimo=true al AGREGAR un cupón a "Mis
  // cupones" (el monto mínimo se revalida al aplicar en checkout).
  const ignorarMinimo = body.ignorar_minimo === true

  if (!codigo || codigo.length < 4 || codigo.length > 32) {
    return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 400 })
  }
  if (!Number.isFinite(subtotalCents) || subtotalCents < 0) {
    return NextResponse.json({ ok: false, error: 'Subtotal inválido' }, { status: 400 })
  }

  // user_id opcional (para validar primera_compra)
  const { userId } = await auth().catch(() => ({ userId: null }))

  const result = await validateCoupon(
    normalizeCouponCode(codigo),
    subtotalCents,
    userId,
    customerEmail,
    { ignorarMinimo }
  )

  if (!result.ok) {
    const status =
      result.error_code === 'no_db' ? 503 :
      result.error_code === 'internal' ? 500 : 400
    return NextResponse.json(
      { ok: false, error: result.error, error_code: result.error_code },
      { status }
    )
  }

  return NextResponse.json({
    ok: true,
    codigo: result.coupon!.codigo,
    discount_percent: result.coupon!.porcentaje_descuento,
    discount_cents: result.discount_cents,
    tipo: result.coupon!.tipo,
    // [P2b] Cupón para la página /cupones (vigencia, monto mínimo, usos).
    // [FIX Ronda 2] toPublicCoupon: excluye order_id (puede ser la orden de
    // otro usuario) y campos internos. Backward-compatible: el checkout solo
    // usa los campos de arriba.
    coupon: toPublicCoupon(result.coupon!),
  })
}
