/**
 * GET /api/user/points
 *
 * Retorna el balance de puntos y email del usuario logueado (Clerk).
 * Si no hay sesión, retorna 401.
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'

export const runtime = 'nodejs'

export async function GET() {
  // Verificar sesión Clerk
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'not_authenticated' },
      { status: 401 }
    )
  }

  // Fix CODE2-022: error_code cambiado de 'no_supabase' a 'no_db'.
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'no_db' },
      { status: 503 }
    )
  }

  // Fix CRIT-4: query directa con Neon (sin stub).
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''

  let balance = 0
  let customerId: string | null = null

  const customer = await queryOne<any>(`
    SELECT id, user_id FROM customers WHERE user_id = $1 OR email = $2 LIMIT 1
  `, [userId, email])

  if (customer) {
    customerId = customer.id
    // Fix FLOW3-004: sincronizar customer.user_id si se encontró por email.
    if (!customer.user_id) {
      await query(
        `UPDATE customers SET user_id = $1 WHERE id = $2 AND user_id IS NULL`,
        [userId, customer.id]
      )
    }
    const balRow = await queryOne<any>(`
      SELECT points_balance FROM customer_point_balances WHERE customer_id = $1
    `, [customerId])
    balance = balRow?.points_balance ?? 0
  }

  return NextResponse.json({
    ok: true,
    email,
    balance,
    customer_id: customerId,
  })
}
