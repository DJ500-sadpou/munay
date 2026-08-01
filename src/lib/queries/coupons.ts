/**
 * Cupones de descuento generales — tabla `coupons`.
 *
 * Sistema INDEPENDIENTE de:
 *   - flash_codes  (código flash → descubrimiento, NO descuento en checkout)
 *   - loyalty_coupons (fidelidad por usuario, prefijo FID-)
 *
 * Flujo:
 *   checkout → validateCoupon() (preview, no consume)
 *   createOrder → consume atómico dentro de la transacción
 *                 (UPDATE ... WHERE usos_actuales < usos_maximos)
 */

import { query, queryOne, transaction, isDbConfigured } from '@/lib/db/neon'

export type CouponType = 'general' | 'primera_compra'

export interface Coupon {
  id: string
  codigo: string
  tipo: CouponType
  porcentaje_descuento: number
  monto_minimo_compra: number
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  usos_maximos: number | null
  usos_actuales: number
  order_id: string | null
  created_at: string
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * [FIX #21] Normaliza un código de cupón: trim + uppercase.
 * MUNAY25 == munay25 == " munay25 "
 */
export function normalizeCouponCode(code: string): string {
  return (code ?? '').trim().toUpperCase()
}

function mapCoupon(row: any): Coupon {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    porcentaje_descuento: Number(row.porcentaje_descuento),
    monto_minimo_compra: Number(row.monto_minimo_compra),
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    activo: row.activo,
    usos_maximos: row.usos_maximos != null ? Number(row.usos_maximos) : null,
    usos_actuales: Number(row.usos_actuales),
    order_id: row.order_id ?? null,
    created_at: row.created_at,
  }
}

// ──────────────────────────────────────────────
// Validación (preview — NO consume)
// ──────────────────────────────────────────────

export interface ValidateCouponResult {
  ok: boolean
  coupon?: Coupon
  discount_cents?: number
  error?: string
  error_code?:
    | 'no_db'
    | 'not_found'
    | 'inactive'
    | 'not_started'
    | 'expired'
    | 'exhausted'
    | 'min_amount'
    | 'first_purchase'
    | 'internal'
}

/**
 * Valida un cupón sin consumirlo. Respeta activo, fechas, usos_máximos,
 * monto_mínimo y tipo (primera_compra).
 *
 * Se usa en `/api/coupons/apply` para dar feedback al usuario en el
 * checkout (aplicado ✓ / monto mínimo / agotado / vencido). El consumo
 * real ocurre SOLO en createOrder (transacción atómica), para no
 * gastar el cupón si el usuario abandona el checkout.
 */
export async function validateCoupon(
  code: string,
  subtotalCents: number,
  userId?: string | null,
  customerEmail?: string | null
): Promise<ValidateCouponResult> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada', error_code: 'no_db' }
  const normalized = normalizeCouponCode(code)

  try {
    // [FIX Ronda 1] lower(codigo) para alinearse con el índice único
    // case-insensitive y aceptar códigos almacenados en minúscula.
    const row = await queryOne<any>(`SELECT * FROM coupons WHERE lower(codigo) = $1`, [normalized.toLowerCase()])
    if (!row) return { ok: false, error: 'Cupón no encontrado', error_code: 'not_found' }
    if (!row.activo) return { ok: false, error: 'Cupón inactivo', error_code: 'inactive' }

    const now = new Date()
    if (new Date(row.fecha_inicio) > now) {
      return { ok: false, error: 'Cupón aún no vigente', error_code: 'not_started' }
    }
    if (new Date(row.fecha_fin) < now) {
      return { ok: false, error: 'Cupón expirado', error_code: 'expired' }
    }
    if (row.usos_maximos != null && Number(row.usos_actuales) >= Number(row.usos_maximos)) {
      return { ok: false, error: 'Cupón agotado', error_code: 'exhausted' }
    }
    if (Number(row.monto_minimo_compra) > subtotalCents) {
      return {
        ok: false,
        error: `Monto mínimo de $${(Number(row.monto_minimo_compra) / 100).toFixed(2)}`,
        error_code: 'min_amount',
      }
    }

    // [FIX #11] tipo primera_compra: solo aplica si el usuario NO tiene órdenes pagadas previas
    // [FIX Ronda 2] El enum order_status es ('pending','paid','cancelled','refunded') —
    // no existe 'completed'. Solo 'paid' cuenta como compra previa (una orden
    // reembolsada — status 'refunded' — tampoco cuenta, por diseño).
    // [F1 Ronda 2 — CRÍTICO] Un guest (sin userId) NO puede aplicar un cupón de
    // primera_compra, aunque su email sea nuevo: el prompt exige "no autenticados
    // no ven NI pueden aplicar". El userId SIEMPRE viene de auth() en servidor,
    // nunca del body del cliente (spoofing).
    if (row.tipo === 'primera_compra') {
      if (!userId) {
        return {
          ok: false,
          error: 'Inicia sesión para usar este cupón',
          error_code: 'first_purchase',
        }
      }
      const prior = await queryOne<any>(
        `SELECT 1 FROM orders
         WHERE status = 'paid'
           AND ((user_id IS NOT NULL AND user_id = $1) OR (lower(customer_email) = $2))
         LIMIT 1`,
        [userId ?? null, (customerEmail ?? '').toLowerCase()]
      )
      if (prior) {
        return { ok: false, error: 'Este cupón aplica solo a tu primera compra', error_code: 'first_purchase' }
      }
    }

    const coupon = mapCoupon(row)
    const discount_cents = Math.round(subtotalCents * (coupon.porcentaje_descuento / 100))
    return { ok: true, coupon, discount_cents }
  } catch (err: any) {
    // [FIX Ronda 2] Tolerancia a deploy antes de la migración: si la tabla
    // coupons aún no existiera, responder not_found (400) en vez de internal (500).
    // Tras aplicar la 00022 la tabla ya existe, pero la tolerancia no hace daño.
    if (String(err?.message ?? '').includes('does not exist')) {
      return { ok: false, error: 'Cupón no encontrado', error_code: 'not_found' }
    }
    console.warn('[coupons] validateCoupon error:', err?.message)
    return { ok: false, error: 'Error validando cupón', error_code: 'internal' }
  }
}

// ──────────────────────────────────────────────
// Cupones activos (para sección "Cupones y Ofertas" y admin)
// ──────────────────────────────────────────────

/**
 * [F1.3] Cupones activos FILTRADOS por historial del usuario (vista pública).
 *
 * Requisito del prompt (Ronda 1+2): "no autenticados no ven ni pueden aplicar"
 * cupones de primera_compra.
 *   - Guests (`userId` y `email` null) → SOLO cupones `general`.
 *   - Usuario con órdenes pagadas previas → SOLO `general`.
 *   - Usuario sin compras pagadas → `general` + `primera_compra`.
 *
 * Se usa en la landing (server component) pasando `userId`/`email` desde
 * `currentUser()` — nunca desde el cliente.
 *
 * [FIX Ronda 1] Se eliminó `getActiveCoupons()` (sin llamadores tras migrar
 * la landing) y esta función quedó como UNA sola query con filtro condicional
 * en vez de tres SELECTs duplicados.
 */
export async function getActiveCouponsForUser(
  userId?: string | null,
  email?: string | null
): Promise<Coupon[]> {
  if (!isDbConfigured()) return []

  try {
    // Guests (sin identidad) → nunca ven primera_compra.
    const hasIdentity = Boolean(userId || email)

    // Identificado: ¿tiene compras pagadas previas?
    const prior = hasIdentity
      ? await queryOne<any>(
          `SELECT 1 FROM orders
           WHERE status = 'paid'
             AND ((user_id IS NOT NULL AND user_id = $1) OR (lower(customer_email) = $2))
           LIMIT 1`,
          [userId ?? null, (email ?? '').toLowerCase()]
        )
      : null

    // Visibilidad: SOLO `general` si es guest o ya compró; si no,
    // `general` + `primera_compra` ($1::boolean true → sin filtro de tipo).
    const showFirstPurchase = hasIdentity && !prior

    const rows = await query<any>(
      `SELECT * FROM coupons
       WHERE activo = true
         AND ($1::boolean OR tipo = 'general')
         AND fecha_inicio <= now() AND fecha_fin > now()
         AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
       ORDER BY created_at DESC`,
      [showFirstPurchase]
    )
    return rows.map(mapCoupon)
  } catch (err: any) {
    console.warn('[coupons] getActiveCouponsForUser error:', err?.message)
    return []
  }
}

// ──────────────────────────────────────────────
// Admin CRUD (F2) — tabla `coupons`
// ──────────────────────────────────────────────

export interface CouponInput {
  codigo: string
  tipo: CouponType
  porcentaje_descuento: number
  monto_minimo_compra: number
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  usos_maximos: number | null
}

/**
 * Retorna TODOS los cupones (incluye inactivos/expirados/agotados) para el admin.
 */
export async function getAllCoupons(): Promise<Coupon[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await query<any>(`SELECT * FROM coupons ORDER BY created_at DESC`)
    return rows.map(mapCoupon)
  } catch (err: any) {
    console.warn('[coupons] getAllCoupons error:', err?.message)
    return []
  }
}

/**
 * Retorna un cupón por id (para edición).
 */
export async function getCouponById(id: string): Promise<Coupon | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await queryOne<any>(`SELECT * FROM coupons WHERE id = $1`, [id])
    return row ? mapCoupon(row) : null
  } catch (err: any) {
    console.warn('[coupons] getCouponById error:', err?.message)
    return null
  }
}

/**
 * Crea un cupón. Normaliza el código (trim+upper).
 */
export async function createCoupon(input: CouponInput): Promise<{ ok: boolean; error?: string; coupon?: Coupon }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }
  const codigo = normalizeCouponCode(input.codigo)
  try {
    const rows = await query<any>(
      `INSERT INTO coupons (codigo, tipo, porcentaje_descuento, monto_minimo_compra,
                            fecha_inicio, fecha_fin, activo, usos_maximos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [codigo, input.tipo, input.porcentaje_descuento, input.monto_minimo_compra,
       input.fecha_inicio, input.fecha_fin, input.activo, input.usos_maximos]
    )
    return { ok: true, coupon: mapCoupon(rows[0]) }
  } catch (err: any) {
    if (err?.code === '23505') {
      return { ok: false, error: 'Ya existe un cupón con ese código' }
    }
    if (String(err?.message ?? '').includes('does not exist')) {
      return { ok: false, error: 'La tabla de cupones no existe. Ejecuta la migración 00020 en Neon.' }
    }
    console.warn('[coupons] createCoupon error:', err?.message)
    return { ok: false, error: 'Error al crear el cupón' }
  }
}

/**
 * Actualiza un cupón por id.
 */
export async function updateCoupon(id: string, input: CouponInput): Promise<{ ok: boolean; error?: string; coupon?: Coupon }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }
  const codigo = normalizeCouponCode(input.codigo)
  try {
    const rows = await query<any>(
      `UPDATE coupons SET
         codigo = $2, tipo = $3, porcentaje_descuento = $4, monto_minimo_compra = $5,
         fecha_inicio = $6, fecha_fin = $7, activo = $8, usos_maximos = $9
       WHERE id = $1
       RETURNING *`,
      [id, codigo, input.tipo, input.porcentaje_descuento, input.monto_minimo_compra,
       input.fecha_inicio, input.fecha_fin, input.activo, input.usos_maximos]
    )
    if (rows.length === 0) return { ok: false, error: 'Cupón no encontrado' }
    return { ok: true, coupon: mapCoupon(rows[0]) }
  } catch (err: any) {
    if (err?.code === '23505') {
      return { ok: false, error: 'Ya existe otro cupón con ese código' }
    }
    console.warn('[coupons] updateCoupon error:', err?.message)
    return { ok: false, error: 'Error al actualizar el cupón' }
  }
}

/**
 * Elimina un cupón (cascade borra coupon_usages).
 */
export async function deleteCoupon(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }
  try {
    await query(`DELETE FROM coupons WHERE id = $1`, [id])
    return { ok: true }
  } catch (err: any) {
    console.warn('[coupons] deleteCoupon error:', err?.message)
    return { ok: false, error: 'Error al eliminar el cupón' }
  }
}

/**
 * [FIX #15] Resetea el contador de usos de un cupón a 0 y limpia los
 * registros de consumo (coupon_usages) y el order_id informativo.
 *
 * [FIX Ronda 1] Atómico (transaction): si falla el DELETE de usages,
 * el UPDATE de usos_actuales se revierte (evita el doble-decremento
 * del CRON 00021 sobre un cupón reseteado).
 */
export async function resetCouponUses(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }
  try {
    await transaction(async (tx) => {
      await tx`UPDATE coupons SET usos_actuales = 0, order_id = NULL WHERE id = ${id}`
      await tx`DELETE FROM coupon_usages WHERE coupon_id = ${id}`
    })
    return { ok: true }
  } catch (err: any) {
    console.warn('[coupons] resetCouponUses error:', err?.message)
    return { ok: false, error: 'Error al resetear los usos' }
  }
}
