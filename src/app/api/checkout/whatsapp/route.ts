/**
 * POST /api/checkout/whatsapp
 *
 * Endpoint unificado para el checkout vía WhatsApp.
 * 1. Crea la orden (createOrder)
 * 2. Crea un ticket con los datos del pedido
 * 3. Retorna URL de WhatsApp con mensaje formateado
 *
 * El pago se coordina directamente por WhatsApp (sin tarjeta).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query, isDbConfigured } from '@/lib/db/neon'
import { createOrder } from '@/lib/orders-neon'
import { SITE } from '@/lib/constants'
import { requireTurnstile } from '@/lib/auth/turnstile'

export const runtime = 'nodejs'

// Rate limiter simple en memoria (10s entre intentos)
const ipTimestamps = new Map<string, number>()
const RATE_LIMIT_MS = 10_000 // 10 segundos

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
  // Rate limiting (antes de parsear body para rechazar rápido)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Intenta en 10 segundos.' },
      { status: 429 }
    )
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  // Verificar Turnstile (anti-bot) — después de parsear body, antes de procesar
  const turnstileCheck = await requireTurnstile(
    body.turnstile_token,
    ip
  )
  if (!turnstileCheck.ok) {
    return turnstileCheck.response!
  }

  // Validar campos obligatorios con límites de longitud
  // NOTA: el checkout envía `customer_name`, no `name`
  const name = (body.customer_name ?? '').trim()
  const email = (body.customer_email ?? '').trim().toLowerCase()
  const phone = (body.phone ?? '').trim()
  const items = body.items ?? []

  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json({ ok: false, error: 'El nombre debe tener entre 2 y 100 caracteres' }, { status: 400 })
  }
  if (!email || !email.includes('@') || email.length > 255) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 })
  }
  if (body.address && typeof body.address === 'string' && body.address.length > 500) {
    return NextResponse.json({ ok: false, error: 'La dirección es demasiado larga' }, { status: 400 })
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'Carrito vacío' }, { status: 400 })
  }
  if (items.length > 50) {
    return NextResponse.json({ ok: false, error: 'Demasiados items en el carrito' }, { status: 400 })
  }

  try {
    // Detectar usuario logueado para puntos/cupones
    const { userId } = await auth()

    // 1. Crear la orden
    const orderResult = await createOrder({
      items: items.map((i: any) => ({
        product_id: i.product_id,
        qty: i.qty,
        // [BLOQUE B] flash_code por ítem: createOrder aplica
        // precio_especial_cents de forma autoritativa.
        flash_code: i.flash_code ?? null,
      })),
      customer_email: email,
      customer_name: name,
      shipping_name: name,
      shipping_address: body.address,
      shipping_city: body.city,
      shipping_province: body.province,
      shipping_phone: phone,
      shipping_cents: body.shipping_cents ?? 200,
      flash_code: body.flash_code ?? null,     // Legacy — createOrder lo ignora (F1)
      coupon_code: body.coupon_code ?? null,   // F1: cupón de descuento (tabla coupons)
      loyalty_code: body.loyalty_code ?? null,
      points_to_redeem: body.points_to_redeem,
      user_id: userId ?? null,
    })

    if (!orderResult.ok) {
      return NextResponse.json(
        { ok: false, error: orderResult.error, error_code: orderResult.error_code },
        { status: 422 }
      )
    }

    const orderId = orderResult.order_id!

    // 2. Construir mensaje de WhatsApp (solo datos básicos — sin exponer datos personales completos en URL)
    const itemsSummary = items.map((i: any, idx: number) =>
      `${idx + 1}. ${i.title ?? 'Producto'} × ${i.qty}`
    ).join('\n')

    // [FIX #9] El mensaje muestra el descuento que efectivamente ganó
    const discountCents = orderResult.discount_cents ?? 0
    const discountLine = discountCents > 0
      ? `🏷️ *Descuento aplicado:* $${(discountCents / 100).toFixed(2)}\n`
      : ''

    const whatsappMessage = encodeURIComponent(
      `🛍️ *Nuevo pedido - Munay*\n\n` +
      `¡Hola! Quiero realizar el siguiente pedido:\n\n` +
      `📦 *Productos:*\n${itemsSummary}\n\n` +
      `${discountLine}` +
      `💰 *Total estimado:* $${(orderResult.total_cents! / 100).toFixed(2)}\n` +
      `🆔 *Orden:* ${orderId.slice(0, 8)}…\n\n` +
      `Quedo atento/a a tu respuesta para coordinar el pago y envío. ¡Gracias! 🙌`
    )

    const whatsappUrl = `https://wa.me/${SITE.whatsapp}?text=${whatsappMessage}`

    // 3. Crear ticket con los datos del pedido
    let ticketId: string | null = null
    try {
      const ticketResult = await query<any>(
        `INSERT INTO tickets (order_id, name, email, phone, message, items, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'new')
         RETURNING id`,
        [
          orderId,
          name,
          email,
          phone || null,
          `Pedido vía WhatsApp - Orden: ${orderId.slice(0, 8)}…`,
          JSON.stringify({ items: items, shipping: { address: body.address, city: body.city, province: body.province } }),
        ]
      )
      ticketId = ticketResult[0]?.id ?? null
    } catch (err) {
      console.warn('[checkout/whatsapp] Error creando ticket (no bloqueante):', err)
    }

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      ticket_id: ticketId,
      whatsapp_url: whatsappUrl,
      total_cents: orderResult.total_cents,
      message: 'Pedido registrado. Serás redirigido a WhatsApp para confirmar.',
    })
  } catch (err: any) {
    console.error('[checkout/whatsapp] Error:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno procesando el pedido' },
      { status: 500 }
    )
  }
}
