/**
 * Sistema de Puntos y Niveles (Módulo 1)
 *
 * Tablas:
 *   - loyalty_levels (catálogo: bronce, plata, oro, andino)
 *   - users.level_id (nivel actual del usuario)
 *   - Vista: user_levels (cálculo automático del nivel según saldo)
 *
 * Flujo:
 *   Después de cada earn de puntos → recalcular nivel y actualizar users.level_id
 *   En UI mostrar LevelBadge + LevelProgressBar
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'

// ──────────────────────────────────────────────
// Helpers compartidos
// ──────────────────────────────────────────────

/**
 * Resuelve el levelKey a partir del nombre en español/inglés.
 */
export function resolveLevelKey(name?: string): LevelKey {
  if (!name) return 'bronce'
  const lower = name.toLowerCase()
  if (lower === 'bronce' || lower === 'bronze') return 'bronce'
  if (lower === 'plata' || lower === 'silver') return 'plata'
  if (lower === 'oro' || lower === 'gold') return 'oro'
  if (lower === 'andino') return 'andino'
  return 'bronce'
}
import { POINTS_RULES } from '@/lib/constants'

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

export interface LoyaltyLevel {
  id: number
  name: string
  min_points: number
  early_access_hours: number
  color_token: string // 'warm-gray' | 'turquesa' | 'terracota' | 'cacao-turquesa'
}

export interface UserLevelInfo {
  levelId: number
  levelName: string
  colorToken: string
  pointsBalance: number
  earlyAccessHours: number
  nextLevel: {
    name: string
    min_points: number
    points_needed: number
    progress_percent: number
  } | null
}

// ──────────────────────────────────────────────
// Constantes de niveles
// ──────────────────────────────────────────────

export const LEVELS_CONFIG = {
  bronce: {
    name: 'Bronce',
    min_points: 0,
    early_access_hours: 0,
    color_token: 'warm-gray',
    label_color: 'text-munay-warm-gray',
    bg_color: 'bg-munay-warm-gray/10',
    border_color: 'border-munay-warm-gray/30',
  },
  plata: {
    name: 'Plata',
    min_points: 500,
    early_access_hours: 6,
    color_token: 'turquesa',
    label_color: 'text-munay-turquesa',
    bg_color: 'bg-munay-turquesa/10',
    border_color: 'border-munay-turquesa/30',
  },
  oro: {
    name: 'Oro',
    min_points: 2000,
    early_access_hours: 12,
    color_token: 'terracota',
    label_color: 'text-munay-terracota',
    bg_color: 'bg-munay-terracota/10',
    border_color: 'border-munay-terracota/30',
  },
  andino: {
    name: 'Andino',
    min_points: 5000,
    early_access_hours: 24,
    color_token: 'cacao-turquesa',
    label_color: 'text-munay-cacao',
    bg_color: 'bg-munay-cacao/10',
    border_color: 'border-munay-cacao/30',
  },
} as const

export type LevelKey = keyof typeof LEVELS_CONFIG

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Retorna todos los niveles definidos en DB (ordenados por min_points ASC).
 */
export async function getAllLevels(): Promise<LoyaltyLevel[]> {
  if (!isDbConfigured()) return []

  const rows = await query<any>(
    `SELECT id, name, min_points, early_access_hours, color_token
     FROM loyalty_levels
     ORDER BY min_points ASC`
  )

  return rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    min_points: Number(r.min_points),
    early_access_hours: Number(r.early_access_hours),
    color_token: r.color_token,
  }))
}

/**
 * Calcula el nivel de un usuario basado en su saldo de puntos.
 * Usa la vista user_levels (cálculo automático).
 */
export async function getUserLevel(userId: string): Promise<UserLevelInfo | null> {
  if (!isDbConfigured()) return null

  try {
    // Intentar obtener el nivel de la vista
    const row = await queryOne<any>(
      `SELECT level_id, points_balance FROM user_levels WHERE user_id = $1`,
      [userId]
    )

    if (!row) {
      // Si no está en la vista, obtener nivel bronce por defecto
      const defaultLevel = await queryOne<any>(
        `SELECT id, name, min_points, early_access_hours, color_token
         FROM loyalty_levels WHERE name = 'bronce'`
      )
      if (!defaultLevel) return null
      return buildUserLevelInfo(defaultLevel, 0, null)
    }

    const levelId = Number(row.level_id)
    const pointsBalance = Number(row.points_balance)

    const currentLevel = await queryOne<any>(
      `SELECT id, name, min_points, early_access_hours, color_token
       FROM loyalty_levels WHERE id = $1`,
      [levelId]
    )

    if (!currentLevel) return null

    // Buscar el siguiente nivel
    const nextLevel = await queryOne<any>(
      `SELECT name, min_points
       FROM loyalty_levels
       WHERE min_points > $1
       ORDER BY min_points ASC
       LIMIT 1`,
      [currentLevel.min_points]
    )

    return buildUserLevelInfo(currentLevel, pointsBalance, nextLevel)
  } catch (err) {
    console.warn('[loyalty-points] Error getting user level:', err)
    return null
  }
}

/**
 * Helper: construye UserLevelInfo desde datos de DB.
 */
function buildUserLevelInfo(
  level: any,
  pointsBalance: number,
  nextLevel: any | null
): UserLevelInfo {
  const levelKey = level.name as LevelKey
  const config = LEVELS_CONFIG[levelKey] ?? LEVELS_CONFIG.bronce
  const minPoints = Number(level.min_points)

  return {
    levelId: Number(level.id),
    levelName: config.name,
    colorToken: level.color_token,
    pointsBalance,
    earlyAccessHours: Number(level.early_access_hours),
    nextLevel: nextLevel
      ? {
          name: nextLevel.name.charAt(0).toUpperCase() + nextLevel.name.slice(1),
          min_points: Number(nextLevel.min_points),
          points_needed: Number(nextLevel.min_points) - pointsBalance,
          progress_percent: Math.min(
            100,
            Math.round(
              ((pointsBalance - minPoints) /
                (Number(nextLevel.min_points) - minPoints)) *
                100
            )
          ),
        }
      : null,
  }
}

/**
 * Recalcula y actualiza el nivel de un usuario según su saldo de puntos actual.
 * Se ejecuta después de cada earn o redeem de puntos.
 */
export async function recalculateUserLevel(userId: string): Promise<void> {
  if (!isDbConfigured()) return

  try {
    // La vista user_levels ya calcula el nivel correcto
    const row = await queryOne<any>(
      `SELECT level_id FROM user_levels WHERE user_id = $1`,
      [userId]
    )

    if (row) {
      await query(
        `UPDATE users SET level_id = $1 WHERE id = $2`,
        [Number(row.level_id), userId]
      )
    }
  } catch (err) {
    console.warn('[loyalty-points] Error recalculating level:', err)
  }
}

/**
 * Retorna las estadísticas de niveles para el panel admin.
 */
export async function getLevelStats(): Promise<{
  levels: { name: string; count: number }[]
  totalUsers: number
}> {
  if (!isDbConfigured()) return { levels: [], totalUsers: 0 }

  const rows = await query<any>(
    `SELECT ll.name, COUNT(u.id) AS count
     FROM loyalty_levels ll
     LEFT JOIN users u ON u.level_id = ll.id
     GROUP BY ll.id, ll.name
     ORDER BY ll.min_points ASC`
  )

  const totalRow = await queryOne<any>(`SELECT count(*) AS total FROM users`)
  const allLevels = ['bronce', 'plata', 'oro', 'andino']

  return {
    levels: allLevels.map((name) => {
      const found = rows.find((r: any) => r.name === name)
      return {
        name,
        count: found ? Number(found.count) : 0,
      }
    }),
    totalUsers: Number(totalRow?.total ?? 0),
  }
}

// TODO: Integrar recalculateUserLevel() después de award_points() y redeem_points()
// para mantener users.level_id actualizado automáticamente.
