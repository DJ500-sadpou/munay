/**
 * StockRealBadge — Badge de stock real / pieza única.
 *
 * Diferenciador de marca MUNAY (Ajuste 3): a diferencia de competidores
 * que muestran "stock bajo" falso, MUNAY tiene stock genuinamente limitado
 * (ropa usada = unidad única).
 *
 * Regla de Oro:
 *   - Terracota (#C65A2E): acción/autenticidad (NUNCA Terracota Quemado)
 *   - Terracota Quemado está reservado para urgencia máxima de Quincena MUNAY
 *   - Warm Gray: inactivo (sin stock)
 *
 * Comportamiento:
 *   - esUnica=true o quantity=1 en usada → "Pieza única — cuando se acaba, se acaba de verdad."
 *   - quantity entre 2 y lowStockThreshold → "Quedan solo X unidades"
 *   - quantity > lowStockThreshold → "Stock real: X unidades"
 *   - quantity ≤ 0 → "Sin stock"
 */

interface StockRealBadgeProps {
  /** Stock disponible */
  quantity: number
  /** Si es pieza única de segunda mano */
  esUnica?: boolean
  /** Tamaño */
  size?: 'sm' | 'md'
  /** Umbral para stock bajo (default: 5) */
  lowStockThreshold?: number
}

export function StockRealBadge({
  quantity,
  esUnica = false,
  size = 'sm',
  lowStockThreshold = 5,
}: StockRealBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'

  if (quantity <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-munay-warm-gray/40 bg-munay-crema/30 px-2 py-0.5 font-medium text-munay-warm-gray ${sizeClasses}`}
      >
        <span className={`inline-block rounded-full bg-munay-warm-gray ${dotSize}`} aria-hidden />
        Sin stock
      </span>
    )
  }

  // Pieza única (segunda mano o esUnica explícito)
  if (esUnica || quantity === 1) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-munay-terracota/30 bg-munay-terracota/[0.06] px-2 py-0.5 font-medium text-munay-terracota ${sizeClasses}`}
      >
        <span className={`inline-block rounded-full bg-munay-terracota ${dotSize}`} aria-hidden />
        Pieza única — cuando se acaba, se acaba de verdad.
      </span>
    )
  }

  // Stock bajo (múltiples unidades, pocas)
  if (quantity <= lowStockThreshold) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-munay-terracota/30 bg-munay-terracota/[0.06] px-2 py-0.5 font-medium text-munay-terracota ${sizeClasses}`}
      >
        <span className={`inline-block rounded-full bg-munay-terracota ${dotSize}`} aria-hidden />
        Quedan solo {quantity} unidades
      </span>
    )
  }

  // Stock normal
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-munay-warm-gray/30 bg-munay-crema/20 px-2 py-0.5 font-medium text-munay-terracota ${sizeClasses}`}
    >
      <span className={`inline-block rounded-full bg-munay-terracota/40 ${dotSize}`} aria-hidden />
      Stock real: {quantity} unidades
    </span>
  )
}
