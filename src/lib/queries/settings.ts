/**
 * Configuración key/value en runtime — tabla `settings` (migración 00023).
 *
 * Un solo mecanismo para toggles y umbrales configurables SIN redeploy:
 *   - auto_expire_tickets_enabled                  (Parte 4 — F3.4)
 *   - coupon_first_purchase_warning_threshold      (Parte 2 — F1.1)
 *
 * Fallback: si la DB no está configurada o la clave no existe, se retorna
 * el default que el caller provea (constante en constants.ts).
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'

/**
 * Lee una setting como string. `fallback` se usa si la clave no existe
 * o la DB no está disponible (nunca lanza).
 */
export async function getSetting(key: string, fallback: string): Promise<string> {
  if (!isDbConfigured()) return fallback
  try {
    const row = await queryOne<any>(`SELECT value FROM settings WHERE key = $1`, [key])
    return row?.value ?? fallback
  } catch (err: any) {
    console.warn('[settings] getSetting error:', err?.message)
    return fallback
  }
}

/**
 * Lee una setting como número (ej: umbral de advertencia). Si el valor
 * almacenado no es numérico o la clave no existe, retorna `fallback`.
 */
export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key, String(fallback))
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Escribe/actualiza una setting (upsert). Retorna { ok } o { ok:false, error }.
 */
export async function updateSetting(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }
  try {
    await query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    )
    return { ok: true }
  } catch (err: any) {
    console.warn('[settings] updateSetting error:', err?.message)
    return { ok: false, error: 'Error actualizando configuración' }
  }
}
