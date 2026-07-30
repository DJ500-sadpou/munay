/**
 * Campañas Flash / Week Sale (Módulo 2)
 *
 * Tablas:
 *   - flash_campaigns (campañas con fechas reales)
 *   - flash_campaign_products (productos asociados)
 *   - Vista: active_campaigns (solo activas con seconds_remaining)
 *   - Vista: all_campaigns_with_status (todas con estado calculado)
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import type { Campaign } from '@/types/campaign'

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Retorna la campaña activa más próxima a vencer (o null).
 */
export async function getActiveCampaign(): Promise<Campaign | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `SELECT * FROM active_campaigns LIMIT 1`
  )

  if (!row) return null
  return mapRowToCampaign(row)
}

/**
 * Retorna todas las campañas activas (puede haber varias).
 */
export async function getActiveCampaigns(): Promise<Campaign[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT * FROM active_campaigns ORDER BY ends_at ASC`
  )

  return rows.map(mapRowToCampaign)
}

/**
 * Retorna todas las campañas con estado calculado (para admin).
 */
export async function getAllCampaigns(): Promise<Campaign[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT * FROM all_campaigns_with_status ORDER BY created_at DESC`
  )

  return rows.map(mapRowToCampaign)
}

/**
 * Retorna los IDs de productos asociados a una campaña.
 */
export async function getCampaignProductIds(campaignId: string): Promise<string[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT product_id FROM flash_campaign_products WHERE campaign_id = $1`,
    [campaignId]
  )

  return rows.map((r: any) => r.product_id)
}

/**
 * Retorna IDs de productos que están actualmente en oferta flash activa.
 */
export async function getActiveFlashProductIds(): Promise<string[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT DISTINCT fcp.product_id
     FROM active_campaigns ac
     JOIN flash_campaign_products fcp ON fcp.campaign_id = ac.id
     WHERE ac.type = 'flash'`
  )

  return rows.map((r: any) => r.product_id)
}

/**
 * Crea una nueva campaña.
 */
export async function createCampaign(data: {
  name: string
  type: 'flash' | 'week_sale'
  description?: string
  starts_at: string
  ends_at: string
  discount_percent?: number
  points_multiplier?: number
  max_uses?: number
  product_ids?: string[]
}): Promise<Campaign | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `INSERT INTO flash_campaigns (name, type, description, starts_at, ends_at, discount_percent, points_multiplier, max_uses)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.name,
      data.type,
      data.description ?? null,
      data.starts_at,
      data.ends_at,
      data.discount_percent ?? null,
      data.points_multiplier ?? 1,
      data.max_uses ?? null,
    ]
  )

  if (!row) return null

  // Asociar productos si se proveen
  if (data.product_ids && data.product_ids.length > 0) {
    for (const productId of data.product_ids) {
      await query(
        `INSERT INTO flash_campaign_products (campaign_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.id, productId]
      )
    }
  }

  return mapRowToCampaign(row)
}

/**
 * Actualiza el estado activo de una campaña (toggle on/off).
 */
export async function toggleCampaign(campaignId: string, active: boolean): Promise<boolean> {
  if (!isDbConfigured()) return false

  try {
    await query(
      `UPDATE flash_campaigns SET active = $1 WHERE id = $2`,
      [active, campaignId]
    )
    return true
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mapRowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description ?? null,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    discount_percent: row.discount_percent !== null ? Number(row.discount_percent) : null,
    points_multiplier: Number(row.points_multiplier),
    max_uses: row.max_uses !== null ? Number(row.max_uses) : null,
    uses_count: Number(row.uses_count),
    active: row.active,
    product_count: row.product_count !== undefined ? Number(row.product_count) : 0,
    status: row.status ?? 'pending',
    seconds_remaining: row.seconds_remaining !== undefined ? Number(row.seconds_remaining) : null,
    created_at: row.created_at,
  }
}
