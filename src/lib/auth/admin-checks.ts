/**
 * Helpers de verificación admin (Clerk + tabla admins).
 */

import { queryOne } from '@/lib/db/neon'

/**
 * Verifica si el userId está en la tabla admins.
 */
export async function checkAdminRow(userId: string): Promise<boolean> {
  const row = await queryOne<any>(
    `SELECT user_id FROM admins WHERE user_id = $1`,
    [userId]
  )
  return !!row
}
