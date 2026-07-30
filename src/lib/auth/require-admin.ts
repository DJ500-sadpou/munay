/**
 * Helper de Auth para admin (Clerk + tabla admins).
 *
 * Verifica sesión Clerk + fila en public.admins.
 */

import { redirect, notFound } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, isDbConfigured } from '@/lib/db/neon'

export interface AdminUser {
  id: string
  email: string
}

export async function requireAdmin(): Promise<AdminUser> {
  const { userId } = await auth()
  if (!userId) {
    // Usuario no autenticado → redirect a login
    redirect('/admin/login')
  }

  if (!isDbConfigured()) {
    redirect('/admin/login?error=no_db')
  }

  // Verificar si es admin
  const adminRow = await queryOne<any>(
    `SELECT user_id FROM admins WHERE user_id = $1`, [userId]
  )
  if (!adminRow) {
    // 🚨 FIX REDIRECT LOOP (v0.1):
    // Antes: redirect('/admin/login?error=not_admin')
    //   → Clerk <SignIn> en /admin/login ve que el usuario YA está autenticado
    //   → auto-redirige a forceRedirectUrl=/admin → LOOP INFINITO
    // Ahora: notFound() muestra 404, NO redirige, rompe el loop.
    notFound()
  }

  const user = await currentUser()
  return {
    id: userId,
    email: user?.emailAddresses?.[0]?.emailAddress ?? '',
  }
}
