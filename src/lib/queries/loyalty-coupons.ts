/**
 * Cupones de fidelidad — generados automáticamente tras cada compra pagada.
 *
 * Tabla: loyalty_coupons
 * Config: app_config (key='loyalty_coupons', value={ enabled, discount_percent })
 *
 * Flujo:
 *   markOrderPaid() → generateLoyaltyCoupon() (fire-and-forget)
 *   checkout → consumeLoyaltyCoupon() (atómico con UPDATE WHERE used_at IS NULL)
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { randomUUID, randomBytes } from 'crypto'

// ──────────────────────────────────────────────
// Config (lee de app_config con fallback)
// ──────────────────────────────────────────────

export interface LoyaltyConfig {
  enabled: boolean
  min_discount_percent: number
  max_discount_percent: number
}

const DEFAULT_CONFIG: LoyaltyConfig = {
  enabled: true,
  min_discount_percent: 20,
  max_discount_percent: 30,
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  if (!isDbConfigured()) return DEFAULT_CONFIG

  try {
    const row = await queryOne<any>(
      `SELECT value FROM app_config WHERE key = 'loyalty_coupons'`
    )
    if (row?.value) {
      return {
        enabled: row.value.enabled ?? DEFAULT_CONFIG.enabled,
        min_discount_percent: row.value.min_discount_percent ?? DEFAULT_CONFIG.min_discount_percent,
        max_discount_percent: row.value.max_discount_percent ?? DEFAULT_CONFIG.max_discount_percent,
      }
    }
  } catch {
    // Si la tabla no existe o hay error, fallback a default
  }
  return DEFAULT_CONFIG
}

export async function setLoyaltyConfig(config: LoyaltyConfig): Promise<boolean> {
  if (!isDbConfigured()) return false

  try {
    await query(
      `INSERT INTO app_config (key, value) VALUES ('loyalty_coupons', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(config)]
    )
    return true
  } catch (err) {
    console.error('[loyalty] Error guardando config:', err)
    return false
  }
}

// ──────────────────────────────────────────────
// Generación de cupón (post-pago)
// ──────────────────────────────────────────────

export interface CouponData {
  id: string
  code: string
  discount_percent: number
  expires_at: string
}

/**
 * Genera un código único de 8 caracteres alfanuméricos.
 */
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin I,O,0,1 (evita confusiones)
  let code = ''
  const bytes = randomBytes(8)
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return `FID-${code}`
}

/**
 * Genera un cupón de fidelidad para un usuario tras una orden pagada.
 * El % de descuento es aleatorio dentro del rango configurado (min/max).
 * Fire-and-forget — no bloquear si falla.
 */
export async function generateLoyaltyCoupon(
  userId: string,
  orderId: string
): Promise<CouponData | null> {
  if (!isDbConfigured()) return null

  try {
    const config = await getLoyaltyConfig()
    if (!config.enabled) return null

    // Generar % aleatorio dentro del rango [min, max]
    const range = config.max_discount_percent - config.min_discount_percent
    const randomPercent = config.min_discount_percent + Math.round(Math.random() * range)

    const code = generateCouponCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await query(
      `INSERT INTO loyalty_coupons (user_id, order_id, code, discount_percent, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, order_id) DO NOTHING`,
      [userId, orderId, code, randomPercent, expiresAt]
    )

    return {
      id: randomUUID(),
      code,
      discount_percent: randomPercent,
      expires_at: expiresAt,
    }
  } catch (err: any) {
    console.warn('[loyalty] Error generando cupón (no bloqueante):', err?.message)
    return null
  }
}

/**
 * Invalida el cupón de una orden (para reembolsos).
 */
export async function invalidateCouponByOrder(orderId: string): Promise<void> {
  if (!isDbConfigured()) return

  try {
    await query(
      `UPDATE loyalty_coupons SET used_at = now() WHERE order_id = $1 AND used_at IS NULL`,
      [orderId]
    )
  } catch (err) {
    console.warn('[loyalty] Error invalidando cupón por refund:', (err as any)?.message)
  }
}

// ──────────────────────────────────────────────
// Cupones activos del usuario
// ──────────────────────────────────────────────

export interface UserCoupon {
  id: string
  code: string
  discount_percent: number
  expires_at: string
  created_at: string
}

/**
 * Retorna los cupones activos (no usados, no vencidos) de un usuario.
 */
export async function getActiveUserCoupons(userId: string): Promise<UserCoupon[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT id, code, discount_percent, expires_at, created_at
     FROM loyalty_coupons
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [userId]
  )

  return rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    discount_percent: Number(r.discount_percent),
    expires_at: r.expires_at,
    created_at: r.created_at,
  }))
}

/**
 * Retorna el historial de cupones de un usuario (usados + vencidos).
 */
export async function getUserCouponHistory(userId: string): Promise<UserCoupon[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT id, code, discount_percent, expires_at, created_at
     FROM loyalty_coupons
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  )

  return rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    discount_percent: Number(r.discount_percent),
    expires_at: r.expires_at,
    created_at: r.created_at,
  }))
}

// ──────────────────────────────────────────────
// Consumo de cupón (en checkout)
// ──────────────────────────────────────────────

export interface ConsumeCouponResult {
  ok: boolean
  discount_percent?: number
  error?: string
}

/**
 * Consume un cupón de forma atómica.
 * UPDATE WHERE used_at IS NULL — no necesita FOR UPDATE.
 * Retorna el descuento si se consumió exitosamente.
 */
export async function consumeCoupon(
  code: string,
  userId: string
): Promise<ConsumeCouponResult> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }

  try {
    // UPDATE atómico: solo si no se ha usado y no ha expirado
    const rows = await query(
      `UPDATE loyalty_coupons SET used_at = now()
       WHERE code = $1 AND user_id = $2 AND used_at IS NULL AND expires_at > now()
       RETURNING id, discount_percent`,
      [code, userId]
    )

    if (rows.length === 0) {
      // Verificar por qué falló
      const existing = await queryOne<any>(
        `SELECT used_at, expires_at FROM loyalty_coupons WHERE code = $1 AND user_id = $2`,
        [code, userId]
      )
      if (!existing) return { ok: false, error: 'Cupón no encontrado' }
      if (existing.used_at) return { ok: false, error: 'Este cupón ya fue usado' }
      if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
        return { ok: false, error: 'Este cupón ha expirado' }
      }
      return { ok: false, error: 'Cupón inválido' }
    }

    return {
      ok: true,
      discount_percent: Number(rows[0].discount_percent),
    }
  } catch (err: any) {
    console.error('[loyalty] Error consumiendo cupón:', err?.message)
    return { ok: false, error: 'Error interno' }
  }
}

// ──────────────────────────────────────────────
// Stats para admin
// ──────────────────────────────────────────────

export interface LoyaltyStats {
  generated: number
  used: number
  usageRate: number
}

export async function getLoyaltyStats(): Promise<LoyaltyStats> {
  if (!isDbConfigured()) return { generated: 0, used: 0, usageRate: 0 }

  const row = await queryOne<any>(
    `SELECT
       count(*) AS generated,
       count(*) FILTER (WHERE used_at IS NOT NULL) AS used
     FROM loyalty_coupons`
  )

  const generated = Number(row?.generated ?? 0)
  const used = Number(row?.used ?? 0)

  return {
    generated,
    used,
    usageRate: generated > 0 ? Math.round((used / generated) * 100) : 0,
  }
}
