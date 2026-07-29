/**
 * POST /api/orders
 * Crea una orden pending + items + reserva inventario.
 *
 * Body: { items, customer_email, customer_name?, shipping?, flash_code?,
 *         points_to_redeem?, turnstile_token? }
 *
 * Seguridad:
 *   - Sin auth (guest checkout OK), pero si hay sesión Clerk, asocia user_id.
 *   - Precios SIEMPRE del backend (snapshot al crear la orden).
 *   - Turnstile token requerido en producción (FIX CRIT-2).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createOrder } from '@/lib/orders-neon'
import { requireTurnstile } from '@/lib/auth/turnstile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: {
    items: Array<{ product_id: string; qty: number }>
    customer_email: string
    customer_name?: string
    shipping?: {
      name?: string
      address?: string
      city?: string
      province?: string
      phone?: string
    }
    flash_code?: string | null
    points_to_redeem?: number
    turnstile_token?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  // Verificar Turnstile (anti-bot). En dev sin TURNSTILE_SECRET_KEY pasa automáticamente.
  const turnstileCheck = await requireTurnstile(
    body.turnstile_token,
    req.headers.get('x-forwarded-for') ?? undefined
  )
  if (!turnstileCheck.ok) {
    return new NextResponse(turnstileCheck.response!.body, {
      status: turnstileCheck.response!.status,
      headers: turnstileCheck.response!.headers,
    })
  }

  // Detectar user_id si hay sesión Clerk
  let userId: string | null = null
  try {
    const { userId: clerkUserId } = await auth()
    userId = clerkUserId ?? null
  } catch {
    // ignore — guest checkout
  }

  const result = await createOrder({
    items: body.items,
    customer_email: body.customer_email,
    customer_name: body.customer_name,
    shipping_name: body.shipping?.name,
    shipping_address: body.shipping?.address,
    shipping_city: body.shipping?.city,
    shipping_province: body.shipping?.province,
    shipping_phone: body.shipping?.phone,
    flash_code: body.flash_code ?? null,
    points_to_redeem: body.points_to_redeem,
    user_id: userId,
  })

  if (!result.ok) {
    // Fix FLOW2-022: error_code 'no_db' en vez de 'no_supabase'.
    const status =
      result.error_code === 'invalid_input' ? 400 :
      result.error_code === 'product_not_found' || result.error_code === 'insufficient_stock' || result.error_code === 'flash_invalid' || result.error_code === 'points_invalid' ? 422 :
      result.error_code === 'no_db' ? 503 :
      500
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result, { status: 200 })
}
