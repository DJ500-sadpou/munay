/**
 * Helpers de formato (moneda, puntos, fechas) para usar en todo el proyecto.
 * Todos los valores monetarios se manejan internamente en CENTAVOS (integer)
 * para evitar errores de coma flotante.
 */

import { POINTS_RULES, SITE } from './constants'

/** Convierte centavos a string de moneda formateado en es-EC. */
export function formatCents(cents: number, currency: string = SITE.currency): string {
  const value = cents / 100
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Convierte un monto en dólares a centavos (entero). */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** Convierte centavos a dólares (float, solo para display). */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Calcula puntos a otorgar por una orden pagada.
 * Regla: 1 punto por cada $1 real pagado → floor(total_cents / 100).
 */
export function calculateEarnedPoints(totalCents: number): number {
  if (totalCents <= 0) return 0
  return Math.floor(totalCents / 100)
}

/**
 * Convierte puntos a redimir en descuento en centavos.
 * Regla: 10 puntos = $1 → 10 puntos = 100 centavos → 1 punto = 10 centavos.
 */
export function pointsToDiscountCents(points: number): number {
  if (points <= 0) return 0
  // Solo se pueden redimir en múltiplos de POINTS_RULES.MIN_POINTS_TO_REDEEM
  const redeemable = Math.floor(points / POINTS_RULES.MIN_POINTS_TO_REDEEM) * POINTS_RULES.MIN_POINTS_TO_REDEEM
  return Math.floor(redeemable / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100
}

/** Formatea una fecha ISO en formato legible es-EC. */
export function formatDate(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
    ...opts,
  }).format(d)
}

/** Trunca texto largo para previews. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

/** Convierte un título arbitrario en slug URL-safe. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}
