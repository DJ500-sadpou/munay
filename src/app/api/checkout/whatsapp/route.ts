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

export const runtime = 'nodejs'

// Rate limiter simple en memoria
const ipTimestamps = new Map<string, number>()
const RATE_LIMIT_MS = 60_000 // 1 minuto

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
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
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

  // Validar campos obligatorios
  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phone = (body.phone ?? '').trim()
  const items = body.items ?? []

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 })
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'Carrito vacío' }, { status: 400 })
  }

  try {
    // Detectar usuario logueado para puntos/cupones
    const { userId } = await auth()

    // 1. Crear la orden
    const orderResult = await createOrder({
      items: items.map((i: any) => ({ product_id: i.product_id, qty: i.qty })),
      customer_email: email,
      customer_name: name,
      shipping_name: name,
      shipping_address: body.address,
      shipping_city: body.city,
      shipping_province: body.province,
      shipping_phone: phone,
      shipping_cents: body.shipping_cents ?? 200,
      flash_code: body.flash_code ?? null,
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

    const whatsappMessage = encodeURIComponent(
      `🛍️ *Nuevo pedido - Munay*\n\n` +
      `¡Hola! Quiero realizar el siguiente pedido:\n\n` +
      `📦 *Productos:*\n${itemsSummary}\n\n` +
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
