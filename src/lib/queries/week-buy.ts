/**
 * Week Buy — Compra Semanal por Categoría (Módulo 3)
 *
 * Tablas:
 *   - week_buy_campaigns (campaña semanal con categoría, descuento, meta)
 *   - week_buy_commitments (usuarios comprometidos)
 *   - Vista: active_week_buy (campaña activa con progreso)
 *
 * Estados visuales:
 *   - Estado A (sin campaña activa): Banner turquesa tenue "Próxima Quincena Munay"
 *   - Estado B (campaña activa): Banner cacao + countdown + formulario commit
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import type { WeekBuyCampaign, WeekBuyCommitment } from '@/types/week-buy'

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Retorna la campaña Week Buy activa (o null).
 */
export async function getActiveWeekBuy(): Promise<WeekBuyCampaign | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `SELECT * FROM active_week_buy ORDER BY close_at ASC LIMIT 1`
  )

  if (!row) return null
  return mapRowToCampaign(row)
}

/**
 * Retorna todas las campañas Week Buy (para admin).
 */
export async function getAllWeekBuyCampaigns(): Promise<WeekBuyCampaign[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT
       wbc.*,
       extract(epoch from (wbc.close_at - now()))::bigint as seconds_remaining,
       case
         when wbc.commitments_count >= wbc.min_commitments then 'goal_reached'
         else 'collecting'
       end as progress_status,
       round((wbc.commitments_count::numeric / nullif(wbc.min_commitments, 0)) * 100)::integer as progress_percent
     FROM week_buy_campaigns wbc
     ORDER BY wbc.created_at DESC`
  )

  return rows.map(mapRowToCampaign)
}

/**
 * Retorna los compromisos de una campaña.
 */
export async function getCampaignCommitments(campaignId: string): Promise<WeekBuyCommitment[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT * FROM week_buy_commitments WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [campaignId]
  )

  return rows.map((r: any) => ({
    id: r.id,
    campaign_id: r.campaign_id,
    user_id: r.user_id,
    email: r.email,
    notified: r.notified,
    created_at: r.created_at,
  }))
}

/**
 * Verifica si un usuario ya se comprometió en una campaña.
 */
export async function hasUserCommitted(campaignId: string, userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false

  const row = await queryOne<any>(
    `SELECT 1 FROM week_buy_commitments WHERE campaign_id = $1 AND user_id = $2`,
    [campaignId, userId]
  )

  return !!row
}

/**
 * Registra el compromiso de un usuario en una campaña.
 */
export async function commitToWeekBuy(
  campaignId: string,
  userId: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }

  try {
    // Verificar que la campaña existe y está activa
    const campaign = await queryOne<any>(
      `SELECT id, close_at FROM week_buy_campaigns WHERE id = $1 AND active = true AND close_at > now()`,
      [campaignId]
    )

    if (!campaign) {
      return { ok: false, error: 'Campaña no disponible' }
    }

    // Insertar compromiso (ON CONFLICT = ya comprometido)
    await query(
      `INSERT INTO week_buy_commitments (campaign_id, user_id, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id, user_id) DO NOTHING`,
      [campaignId, userId, email]
    )

    // Actualizar contador
    await query(
      `UPDATE week_buy_campaigns SET commitments_count = (
        SELECT count(*) FROM week_buy_commitments WHERE campaign_id = $1
      ) WHERE id = $1`,
      [campaignId]
    )

    return { ok: true }
  } catch (err: any) {
    console.warn('[week-buy] Error committing:', err?.message)
    return { ok: false, error: 'Error al registrar compromiso' }
  }
}

/**
 * Crea una nueva campaña Week Buy.
 */
export async function createWeekBuyCampaign(data: {
  category: string
  title: string
  description?: string
  close_at: string
  discount_percent?: number
  min_commitments?: number
}): Promise<WeekBuyCampaign | null> {
  if (!isDbConfigured()) return null

  const row = await queryOne<any>(
    `INSERT INTO week_buy_campaigns (category, title, description, close_at, discount_percent, min_commitments)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.category,
      data.title,
      data.description ?? null,
      data.close_at,
      data.discount_percent ?? 15,
      data.min_commitments ?? 20,
    ]
  )

  if (!row) return null
  return mapRowToCampaign(row)
}

/**
 * Actualiza el estado activo de una campaña.
 */
export async function toggleWeekBuyCampaign(id: string, active: boolean): Promise<boolean> {
  if (!isDbConfigured()) return false

  try {
    await query(
      `UPDATE week_buy_campaigns SET active = $1 WHERE id = $2`,
      [active, id]
    )
    return true
  } catch {
    return false
  }
}

/**
 * Retorna las categorías disponibles para Week Buy.
 */
/**
 * Categorías disponibles para Week Buy.
 * @internal Usado internamente — exportado para futura UI de creación en admin.
 */
export function getWeekBuyCategories(): Array<{ value: string; label: string }> {
  return [
    { value: 'chaquetas', label: 'Chaquetas' },
    { value: 'camisetas', label: 'Camisetas' },
    { value: 'pantalones', label: 'Pantalones' },
    { value: 'vestidos', label: 'Vestidos' },
    { value: 'faldas', label: 'Faldas' },
    { value: 'blusas', label: 'Blusas' },
    { value: 'accesorios', label: 'Accesorios' },
    { value: 'calzado', label: 'Calzado' },
  ]
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mapRowToCampaign(row: any): WeekBuyCampaign {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description ?? null,
    close_at: row.close_at,
    discount_percent: Number(row.discount_percent),
    min_commitments: Number(row.min_commitments),
    commitments_count: Number(row.commitments_count),
    active: row.active,
    seconds_remaining: row.seconds_remaining !== undefined ? Number(row.seconds_remaining) : null,
    progress_status: row.progress_status ?? 'collecting',
    progress_percent: row.progress_percent !== undefined ? Number(row.progress_percent) : 0,
    created_at: row.created_at,
  }
}
