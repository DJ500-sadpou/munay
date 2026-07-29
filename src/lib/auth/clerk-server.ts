/**
 * Helper de Auth para server-side usando Clerk.
 *
 * Reemplaza la lectura de sesión de Supabase Auth.
 * Clerk gestiona sesiones via cookies (no JWT en localStorage).
 */

import { auth, currentUser } from '@clerk/nextjs/server'

export interface CurrentUser {
  id: string
  email: string
}

/**
 * Retorna el usuario actual desde Clerk (server-side).
 * Si no hay sesión, retorna null.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { userId } = await auth()
    if (!userId) return null

    const user = await currentUser()
    if (!user) return null

    const email = user.emailAddresses?.[0]?.emailAddress ?? ''
    return { id: userId, email }
  } catch (err) {
    // Si no hay sesión, Clerk lanza 'Unauthorized' — es normal, no loggear.
    if (err instanceof Error && err.message?.includes('Unauthorized')) return null
    // Otros errores (config, rate-limit, etc.) sí merecen log.
    console.error('[auth] getCurrentUser error:', err)
    return null
  }
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
