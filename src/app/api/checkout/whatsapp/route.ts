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
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { createOrder, markOrderCancelled } from '@/lib/orders-neon'
import { SITE, normalizeWhatsAppNumber } from '@/lib/constants'
import { requireTurnstile } from '@/lib/auth/turnstile'

export const runtime = 'nodejs'

// [P0b] Rate limiter por IP: ventana deslizante (3 intentos/minuto).
// El antiguo "1 intento cada 15s" bloqueaba reintentos legítimos: como
// `recordRateLimit` corre ANTES de `createOrder` (createOrder reserva stock
// y consume cupones/puntos, así que NO se puede mover el registro a después
// del éxito o un atacante martillaría esa operación costosa sin límite), un
// 422 de stock/validación registraba el intento y el reintento dentro de 15s
// recibía 429 → nunca llegaba a crear ticket ni a abrir WhatsApp (síntoma
// reportado por Dylan). Con 3 intentos/minuto un flujo normal (1 fallido +
// reintento) pasa, y el spam queda acotado a 3/min por IP.
const ipAttempts = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minuto
const RATE_LIMIT_MAX_ATTEMPTS = 3 // intentos por ventana

function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const attempts = (ipAttempts.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (attempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    // Reintento posible cuando el intento más antiguo salga de la ventana.
    const oldest = attempts[0]
    return {
      ok: false,
      retryAfterSec: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000),
    }
  }
  return { ok: true }
}

// [AUDIT] Registra el intento SOLO cuando la petición pasó Turnstile y la
// validación (es decir, cuando realmente se va a crear una orden). Antes
// registrábamos TODAS las peticiones, incluidas las fallidas por validación:
// un usuario que corregía un error (ej. stock, email) y reintentaba dentro de
// la ventana recibía 429 — residuo del síntoma R1 original del plan.
function recordRateLimit(ip: string): void {
  const now = Date.now()
  const attempts = (ipAttempts.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  attempts.push(now)
  ipAttempts.set(ip, attempts)
  // [FIX Ronda 1] Prune efectivo: `arr.every(t < cutoff)` era siempre false
  // (el array ya viene filtrado a la ventana) → el Map crecía sin límite con
  // IPs distintas. Se borra por el ÚLTIMO timestamp: si el intento más
  // reciente ya salió de la ventana, la entrada entera está muerta.
  if (ipAttempts.size > 100) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS
    for (const [key, arr] of ipAttempts) {
      const last = arr[arr.length - 1]
      if (arr.length === 0 || last < cutoff) ipAttempts.delete(key)
    }
  }
}

/**
 * [F3.3] Crea el ticket con retry real sobre nextval + INSERT.
 *
 * La colisión real ocurre en el INSERT: la secuencia es CYCLE (0000-9999),
 * así que al dar la vuelta puede reusar un número de un ticket ACTIVO y el
 * índice único parcial tickets_numero_active_idx lanza 23505. Por eso el
 * retry (hasta 10) envuelve AMBOS pasos, no solo el nextval.
 *
 * Retorna { id, numero } o null si agota los intentos (el caller compensa
 * cancelando la orden, nunca deja una orden huérfana ni ticket sin número).
 */
function isNumeroCollision(err: any): boolean {
  // 23505 = unique_violation. Discriminamos por constraint para NO quemar los
  // 10 reintentos ni enmascarar una colisión de OTRA unicidad de `tickets`
  // (p.ej. un índice único futuro sobre order_id). postgres.js expone
  // constraint_name en el error; como respaldo, el nombre aparece en el DETAIL.
  if (err?.code !== '23505') return false
  const name = String(err?.constraint_name ?? '')
  if (name) return name === 'tickets_numero_active_idx'
  return String(err?.message ?? '').includes('tickets_numero_active_idx')
}

type TicketInsertParams = {
  orderId: string
  name: string
  email: string
  phone: string | null
  message: (numero: number) => string
  itemsJson: string
  userId: string | null
  totalCents: number
  descuentoJson: string
}

async function insertTicketWithRetry(
  params: TicketInsertParams
): Promise<{ id: string; numero: number } | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const seqRow = await queryOne<any>(`SELECT nextval('ticket_numero_seq') AS num`)
    const numero = Number(seqRow?.num)
    if (!Number.isFinite(numero)) continue
    try {
      const ticketResult = await query<any>(
        `INSERT INTO tickets (
           order_id, name, email, phone, message, items, status,
           ticket_numero, clerk_user_id, precio_total_cents, descuento_aplicado, fecha_expiracion
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', $7, $8, $9, $10, now() + interval '72 hours')
         RETURNING id`,
        [
          params.orderId,
          params.name,
          params.email,
          params.phone,
          params.message(numero),
          params.itemsJson,
          numero,
          params.userId,
          params.totalCents,
          params.descuentoJson,
        ]
      )
      const id = ticketResult[0]?.id ?? null
      if (!id) throw new Error('Ticket INSERT no retornó id')
      return { id, numero }
    } catch (err: any) {
      if (isNumeroCollision(err)) {
        console.warn('[checkout/whatsapp] ticket_numero colisión, reintento', attempt + 1)
        continue
      }
      throw err
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  // Rate limiting (antes de parsear body para rechazar rápido)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const rl = checkRateLimit(ip)
  if (!rl.ok) {
    const retryAfterSec = rl.retryAfterSec ?? Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    return NextResponse.json(
      { ok: false, error: `Demasiadas solicitudes. Intenta en ${retryAfterSec} segundo${retryAfterSec === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
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

  // [AUDIT] Registrar el intento SOLO aquí (tras Turnstile + validación): los
  // reintentos por errores de validación NO cuentan para el rate limit.
  recordRateLimit(ip)

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

    // [F3.3 #1] Crear ticket como parte del FLUJO PRINCIPAL (no best-effort).
    // ticket_numero (secuencia 4 dígitos con retry anti-colisión), clerk_user_id,
    // items como carrito, precio_total_cents, descuento_aplicado, estado
    // 'pendiente' y expira +72h (alineado con la ventana whatsapp del cron).
    let ticketId: string | null = null
    let ticketNumero: number | null = null
    try {
      const created = await insertTicketWithRetry({
        orderId,
        name,
        email,
        phone: phone || null,
        message: (numero) =>
          `Pedido vía WhatsApp - Ticket: ${String(numero).padStart(4, '0')}`,
        // [AUDIT A3] Guardar en el ticket los items AUTORITATIVOS del servidor
        // (orderResult.order_items: título, qty y precio final resuelto flash vs
        // regular) en vez de los items crudos del cliente (manipulables: un
        // cliente podría enviar title: 'Gratis'). Fallback defensivo a los
        // items del body solo si el server no devolvió order_items.
        itemsJson: JSON.stringify({
          items: orderResult.order_items && orderResult.order_items.length > 0
            ? orderResult.order_items.map((it: any) => ({
                product_id: it.product_id,
                title: it.title,
                qty: it.qty,
                unit_price_cents: it.unit_price_cents,
              }))
            : items,
          shipping: { address: body.address, city: body.city, province: body.province },
        }),
        userId: userId ?? null,
        totalCents: orderResult.total_cents ?? 0,
        descuentoJson: JSON.stringify({
          discount_cents: orderResult.discount_cents ?? 0,
          promo_applied: orderResult.promo_applied ?? 'none',
          flash_discount_percent: orderResult.flash_discount_percent ?? null,
          coupon_discount_percent: orderResult.coupon_discount_percent ?? null,
          loyalty_discount_percent: orderResult.loyalty_discount_percent ?? null,
          points_redeemed: orderResult.points_redeemed ?? 0,
        }),
      })

      if (!created) throw new Error('No se pudo asignar número de ticket (colisiones)')
      ticketId = created.id
      ticketNumero = created.numero
    } catch (ticketErr) {
      // [F3.0 #2] Compensación: la orden ya se creó (con stock reservado y
      // posible consumo de cupón/puntos dentro de su transacción). Si el
      // ticket falla, cancelamos la orden para NO dejar una orden huérfana
      // con stock reservado. NUNCA respondemos ok:true silencioso.
      console.error('[checkout/whatsapp] Error creando ticket:', ticketErr)
      try {
        await markOrderCancelled(orderId, 'ticket_creation_failed')
      } catch (cancelErr) {
        console.error('[checkout/whatsapp] Compensación markOrderCancelled falló:', cancelErr)
      }
      return NextResponse.json(
        { ok: false, error: 'Error creando el ticket del pedido. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // [F3.3 #2] Mensaje prearmado con el número de ticket (#1234)
    // [P0b] Ítems con título, cantidad y PRECIO FINAL autoritativo (ya
    // resuelto flash vs regular en createOrder) — nunca datos crudos del
    // cliente. Si por algún motivo no vienen, fallback al resumen simple.
    const ticketDisplay = `#${String(ticketNumero).padStart(4, '0')}`
    const orderItems = orderResult.order_items ?? []
    const itemsSummary =
      orderItems.length > 0
        ? orderItems.map((it: any, idx: number) =>
            `${idx + 1}. ${it.title ?? 'Producto'} | Cantidad: ${it.qty} | $${((it.unit_price_cents ?? 0) / 100).toFixed(2)}`
          ).join('\n')
        : items.map((i: any, idx: number) =>
            `${idx + 1}. ${i.title ?? 'Producto'} × ${i.qty}`
          ).join('\n')
    // [FIX #9] El mensaje muestra el descuento que efectivamente ganó.
    // [AUDIT] Cuando gana el Código Flash, discount_cents solo contiene
    // puntos (el ahorro flash va embebido en el subtotal) → mostrar el %
    // flash, no "$0.00" (subestimaba el descuento real).
    const discountCents = orderResult.discount_cents ?? 0
    const flashPct =
      orderResult.promo_applied === 'flash' && orderResult.flash_discount_percent != null
        ? orderResult.flash_discount_percent
        : null
    const discountLine = flashPct != null
      ? `⚡ *Código Flash aplicado:* ${flashPct}% OFF\n`
      : discountCents > 0
        ? `🏷️ *Descuento aplicado:* $${(discountCents / 100).toFixed(2)}\n`
        : ''

    const whatsappMessage = encodeURIComponent(
      `🛍️ *Nuevo pedido - Munay*\n\n` +
      `🎟️ *Ticket ${ticketDisplay}*\n\n` +
      `¡Hola! Quiero realizar el siguiente pedido:\n\n` +
      `📦 *Productos:*\n${itemsSummary}\n\n` +
      `${discountLine}` +
      `💰 *Total estimado:* $${(orderResult.total_cents! / 100).toFixed(2)}\n` +
      `🆔 *Orden:* ${orderId.slice(0, 8)}…\n\n` +
      `Quedo atento/a a tu respuesta para coordinar el pago y envío. ¡Gracias! 🙌`
    )

    // [F3.3 #3] URL normalizada (wa.me NO acepta '+': solo dígitos).
    const whatsappUrl = `https://wa.me/${normalizeWhatsAppNumber(SITE.whatsapp)}?text=${whatsappMessage}`

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      ticket_id: ticketId,
      ticket_numero: ticketNumero,
      whatsapp_url: whatsappUrl,
      total_cents: orderResult.total_cents,
      // [F2.4] Contrato de no-acumulación → el checkout lo transporta a la
      // success page por query params (&promo=flash&flashPct=…&couponPct=…).
      promo_applied: orderResult.promo_applied ?? null,
      flash_discount_percent: orderResult.flash_discount_percent ?? null,
      coupon_discount_percent: orderResult.coupon_discount_percent ?? null,
      loyalty_discount_percent: orderResult.loyalty_discount_percent ?? null,
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
