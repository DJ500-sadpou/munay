/**
 * Marketplace P2P — Publicaciones de usuarios (Módulo 5)
 *
 * Tablas:
 *   - user_listings (productos publicados por usuarios)
 *   - Vista: published_listings (listings verificados/publicados)
 *
 * Flujo:
 *   Usuario crea listing → status='pending' → Admin verifica →
 *   status='verified' → Visible en marketplace
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import type { UserListing, ListingStatus, ListingCondition } from '@/types/user-listing'

// ──────────────────────────────────────────────
// Queries públicas
// ──────────────────────────────────────────────

/**
 * Retorna los listings publicados/verificados para el marketplace.
 */
export async function getPublishedListings(options?: {
  category?: string
  limit?: number
}): Promise<UserListing[]> {
  if (!isDbConfigured()) return []

  const where: string[] = ["ul.status IN ('verified', 'published')", 'ul.active = true']
  const params: any[] = []
  let paramIdx = 1

  if (options?.category) {
    where.push(`ul.category = $${paramIdx}`)
    params.push(options.category)
    paramIdx++
  }

  const limit = options?.limit ?? 20

  const rows = await query<any>(
    `SELECT ul.* FROM user_listings ul
     WHERE ${where.join(' AND ')}
     ORDER BY ul.created_at DESC
     LIMIT $${paramIdx}`,
    [...params, limit]
  )

  return rows.map(mapRowToListing)
}

/**
 * Retorna los listings de un usuario específico.
 */
export async function getUserListings(userId: string): Promise<UserListing[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT * FROM user_listings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )

  return rows.map(mapRowToListing)
}

/**
 * Retorna un listing por ID.
 */
export async function getListingById(id: string): Promise<UserListing | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `SELECT * FROM user_listings WHERE id = $1`,
    [id]
  )

  if (!row) return null
  return mapRowToListing(row)
}

/**
 * Retorna todos los listings (para admin).
 */
export async function getAllListings(): Promise<UserListing[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT * FROM user_listings ORDER BY created_at DESC`
  )

  return rows.map(mapRowToListing)
}

// ──────────────────────────────────────────────
// Mutaciones
// ──────────────────────────────────────────────

/**
 * Crea un nuevo listing de usuario.
 */
export async function createListing(data: {
  userId: string
  title: string
  description?: string
  category: string
  condition: ListingCondition
  price_cents: number
  images?: string[]
  size?: string
  brand?: string
}): Promise<UserListing | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `INSERT INTO user_listings (user_id, title, description, category, condition, price_cents, images, size, brand)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.userId,
      data.title,
      data.description ?? null,
      data.category,
      data.condition,
      data.price_cents,
      JSON.stringify(data.images ?? []),
      data.size ?? null,
      data.brand ?? null,
    ]
  )

  if (!row) return null
  return mapRowToListing(row)
}

/**
 * Actualiza el estado de un listing (admin: verify / reject).
 */
export async function updateListingStatus(
  id: string,
  status: ListingStatus,
  adminId: string,
  rejectionReason?: string
): Promise<boolean> {
  if (!isDbConfigured()) return false

  try {
    if (status === 'verified') {
      await query(
        `UPDATE user_listings SET status = $1, verified_at = now(), verified_by = $2 WHERE id = $3`,
        [status, adminId, id]
      )
    } else if (status === 'rejected') {
      await query(
        `UPDATE user_listings SET status = $1, verified_by = $2, rejection_reason = $3 WHERE id = $4`,
        [status, adminId, rejectionReason ?? null, id]
      )
    } else {
      await query(
        `UPDATE user_listings SET status = $1 WHERE id = $2`,
        [status, id]
      )
    }
    return true
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mapRowToListing(row: any): UserListing {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    condition: row.condition as ListingCondition,
    price_cents: Number(row.price_cents),
    currency: row.currency ?? 'USD',
    images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images ?? []),
    size: row.size ?? null,
    brand: row.brand ?? null,
    status: row.status as ListingStatus,
    verified_at: row.verified_at ?? null,
    verified_by: row.verified_by ?? null,
    rejection_reason: row.rejection_reason ?? null,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
