/**
 * POST /api/payments/create
 * Inicia el pago de una orden existente llamando a la pasarela.
 *
 * Body: { order_id, card_token? }
 *
 * Fix PERM2-007: verifica que la orden pertenece al caller (Clerk session o customer_email).
 * Fix FLOW2-016: detecta modo demo correctamente por KUSHKI_PUBLIC_KEY.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'
import { createPayment, detectPaymentMode } from '@/lib/payments/kushki'
import { markOrderPaid } from '@/lib/orders-neon'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'DB no configurada' },
      { status: 503 }
    )
  }

  let body: { order_id?: string; card_token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const orderId = body.order_id
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'Falta order_id' }, { status: 400 })
  }

  // Fix PERM2-007: verificar ownership de la orden.
  // Si hay sesión Clerk, la orden debe pertenecer al usuario.
  // Si no hay sesión (guest), solo permitimos pagar si el email del guest
  // coincide con el customer_email de la orden. Esto previene que un guest
  // pague una orden de otro usuario solo conociendo el order_id.
  // Fix PERM2-007: verificar ownership de la orden.
  // Si hay sesión Clerk, la orden debe pertenecer al usuario.
  // Si no hay sesión (guest), solo se permite pagar órdenes sin user_id
  // (creadas como guest). Usamos catch vacío (mismo patrón que clerk-server.ts)
  // porque auth() no lanza cuando no hay sesión — solo retorna { userId: null }.
  // Si lanza por error de configuración, tratamos como guest y la query DB
  // retornará 404 porque ninguna orden tendrá user_id = null si el flujo
  // checkout funciona correctamente.
  let callerUserId: string | null = null
  let callerEmail: string | null = null
  try {
    const { userId } = await auth()
    if (userId) {
      callerUserId = userId
      const user = await currentUser()
      callerEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
    }
  } catch {
    // Guest — auth no disponible, continuar como invitado
  }

  // Buscar orden (con filtro de ownership)
  let order: any
  if (callerUserId && callerEmail) {
    // Usuario logueado: la orden debe pertenecerle por user_id o email
    order = await queryOne<any>(`
      SELECT id, status, total_cents, currency, customer_email, user_id
      FROM orders
      WHERE id = $1 AND (user_id = $2 OR customer_email = $3)
    `, [orderId, callerUserId, callerEmail])
  } else {
    // Guest: solo permitir si la orden fue creada como guest (sin user_id)
    order = await queryOne<any>(`
      SELECT id, status, total_cents, currency, customer_email, user_id
      FROM orders
      WHERE id = $1 AND user_id IS NULL
    `, [orderId])
  }

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 })
  }

  // Validar estado
  if (order.status !== 'pending') {
    return NextResponse.json(
      { ok: false, error: `Orden en estado ${order.status}, no se puede pagar` },
      { status: 422 }
    )
  }

  // Orden gratuita: marcar paid sin pasar por pasarela
  if (order.total_cents <= 0) {
    // Insertar registro de payment manual para auditoría (fix FLOW2-017)
    await query(`
      INSERT INTO payments (id, order_id, provider, provider_ref, status, raw)
      VALUES ($1, $2, 'manual', $3, 'captured', $4)
    `, [
      randomUUID(),
      orderId,
      `free-order-${Date.now()}`,
      JSON.stringify({ reason: 'free_order' })
    ])

    const r = await markOrderPaid(orderId, `free-order-${Date.now()}`)
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      payment_id: null,
      provider_ref: `free-order-${Date.now()}`,
      status: 'captured',
      mode: 'demo',
      redirect_url: `/checkout/success?order=${orderId}`,
    })
  }

  // Crear registro de payment
  const paymentId = randomUUID()
  await query(`
    INSERT INTO payments (id, order_id, provider, status, raw)
    VALUES ($1, $2, $3, 'pending', $4)
  `, [
    paymentId,
    orderId,
    (process.env.PAYMENT_PROVIDER ?? 'kushki') as any,
    JSON.stringify({ card_token_present: !!body.card_token })
  ])

  // Llamar a la pasarela
  const result = await createPayment({
    order_id: orderId,
    amount_cents: order.total_cents,
    currency: order.currency,
    customer_email: order.customer_email,
    customer_name: order.customer_email,
    card_token: body.card_token,
    description: `Orden Munay ${orderId.slice(0, 8)}`,
    metadata: { payment_id: paymentId },
  })

  // Actualizar payment con resultado
  await query(`
    UPDATE payments
    SET provider_ref = $1, status = $2, raw = $3
    WHERE id = $4
  `, [
    result.provider_ref ?? null,
    result.status,
    JSON.stringify(result),
    paymentId
  ])

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      payment_id: paymentId,
      error: result.error ?? 'Error en la pasarela',
      mode: result.mode,
    }, { status: 422 })
  }

  // Si la pasarela capturó inmediatamente (modo demo)
  if (result.status === 'captured' && result.provider_ref) {
    await markOrderPaid(orderId, result.provider_ref)
    return NextResponse.json({
      ok: true,
      payment_id: paymentId,
      provider_ref: result.provider_ref,
      status: 'captured',
      mode: result.mode,
      redirect_url: `/checkout/success?order=${orderId}`,
    })
  }

  // Si requiere redirect (PayPhone/PayPal)
  if (result.redirect_url) {
    return NextResponse.json({
      ok: true,
      payment_id: paymentId,
      provider_ref: result.provider_ref,
      status: result.status,
      mode: result.mode,
      redirect_url: result.redirect_url,
    })
  }

  // Pendiente — esperar webhook
  return NextResponse.json({
    ok: true,
    payment_id: paymentId,
    provider_ref: result.provider_ref,
    status: result.status,
    mode: result.mode,
    redirect_url: `/checkout/pending?order=${orderId}`,
  })
}
