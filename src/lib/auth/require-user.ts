/**
 * Helpers de autenticación para usuarios finales (Clerk).
 *
 * Reemplaza la versión Supabase. Clerk maneja sesiones via cookies.
 */

import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'

export interface CurrentUser {
  id: string
  email: string
  customer_id?: string
  points_balance?: number
}

/**
 * Exige sesión. Redirige a /cuenta/login si no hay.
 */
export async function requireUser(redirectAfter?: string): Promise<CurrentUser> {
  const { userId } = await auth()
  if (!userId) {
    const loginUrl = redirectAfter
      ? `/cuenta/login?next=${encodeURIComponent(redirectAfter)}`
      : '/cuenta/login'
    redirect(loginUrl)
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''

  // Buscar customer asociado (puede no existir si nunca compró)
  let customerId: string | undefined
  let pointsBalance: number | undefined

  if (isDbConfigured() && email) {
    // Insertar user si no existe (sync con Clerk)
    const existingUser = await queryOne<any>(
      `SELECT id, email FROM users WHERE id = $1`, [userId]
    )
    if (!existingUser) {
      await query(
        `INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [userId, email]
      )
    } else if (existingUser.email !== email) {
      // Sync email si cambió en Clerk
      await query(
        `UPDATE users SET email = $1 WHERE id = $2 AND email <> $1`,
        [email, userId]
      )
    }

    // Fix CRIT-8: buscar customer por user_id OR email.
    // Si lo encontramos solo por email (guest que se registró después),
    // sincronizar customer.user_id para que pueda redimir puntos.
    const customer = await queryOne<any>(
      `SELECT id, user_id FROM customers WHERE user_id = $1 OR email = $2 LIMIT 1`,
      [userId, email]
    )
    if (customer) {
      customerId = customer.id
      // Si el customer se encontró por email pero user_id es null, sync.
      if (!customer.user_id) {
        await query(
          `UPDATE customers SET user_id = $1 WHERE id = $2 AND user_id IS NULL`,
          [userId, customer.id]
        )
      }
      const balance = await queryOne<any>(
        `SELECT points_balance FROM customer_point_balances WHERE customer_id = $1`,
        [customerId]
      )
      pointsBalance = balance?.points_balance ?? 0
    }
  }

  return {
    id: userId,
    email,
    customer_id: customerId,
    points_balance: pointsBalance,
  }
}

/**
 * Retorna el usuario si hay sesión, sin redirigir.
 */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  if (!user) return null
  const email = user.emailAddresses?.[0]?.emailAddress ?? ''

  let customerId: string | undefined
  let pointsBalance: number | undefined

  if (isDbConfigured() && email) {
    const customer = await queryOne<any>(
      `SELECT id FROM customers WHERE user_id = $1 OR email = $2`,
      [userId, email]
    )
    if (customer) {
      customerId = customer.id
      const balance = await queryOne<any>(
        `SELECT points_balance FROM customer_point_balances WHERE customer_id = $1`,
        [customerId]
      )
      pointsBalance = balance?.points_balance ?? 0
    }
  }

  return { id: userId, email, customer_id: customerId, points_balance: pointsBalance }
}

/**
 * Verifica si hay sesión activa.
 */
export async function isUserLoggedIn(): Promise<boolean> {
  try {
    const { userId } = await auth()
    return !!userId
  } catch {
    return false
  }
}
