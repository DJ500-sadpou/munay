/**
 * [P1][FIX Ronda 5] Aritmética compartida de no-acumulación (carrito + checkout).
 *
 * ANTES el cálculo del ganador (flash / cupón / FID-) y del total estaba
 * DUPLICADO inline en `src/app/checkout/page.tsx`. Al añadir cupones al
 * carrito (P1) se iba a duplicar una tercera vez → riesgo real de drift
 * silencioso entre lo que muestra el carrito, el preview del checkout y lo
 * que finalmente cobra `createOrder` (server-side).
 *
 * Este módulo centraliza LA regla: mismo subtotal regular, mismos savings de
 * flash, misma comparación de ganadores y mismo total ajustado. Carrito y
 * checkout lo importan; si la regla cambia, cambia en un solo lugar.
 *
 * Contrato con `createOrder` (src/lib/orders-neon.ts): el ganador se decide
 * con max(flash, cupón, FID-) sobre el subtotal REGULAR; si gana un cupón o
 * FID-, los ítems flash vuelven a precio regular (base = regularSubtotal).
 * Aquí se replica exactamente esa lógica para que el preview nunca diverja.
 */

import type { CartLine } from '@/store/cart'
// [FIX Ronda 5] Tipo desde la lib (no desde un componente): lib -> lib. Es
// estructuralmente idéntico a `AppliedCoupon` del checkout/carrito, así que
// ambos call sites siguen typechequeando sin casts.
import type { AppliedCouponPayload } from '@/lib/coupon-storage'

export interface PromoInput {
  lines: CartLine[]
  subtotalCents: number
  coupon: AppliedCouponPayload | null
  /** Cupón de fidelidad (FID-) seleccionado; carrito no lo usa. */
  loyaltyPercent?: number
  /** Descuento por redención de puntos; carrito no lo usa. */
  pointsDiscountCents?: number
}

export interface PromoResult {
  regularSubtotalCents: number
  flashSavingsCents: number
  flashPct: number
  couponDiscountCents: number
  loyaltyDiscountCents: number
  flashWins: boolean
  couponWins: boolean
  loyaltyWins: boolean
  promoDiscountCents: number
  baseSubtotalCents: number
  adjustedTotalCents: number
  shipping: number
  grandTotal: number
}

/** Envío plano (igual que checkout/createOrder). */
const SHIPPING_FLAT_CENTS = 200

export function computePromo(input: PromoInput): PromoResult {
  const { lines, subtotalCents, coupon, loyaltyPercent = 0, pointsDiscountCents = 0 } = input

  const regularSubtotalCents = lines.reduce(
    (s, l) => s + (l.regular_unit_price_cents ?? l.unit_price_cents) * l.qty,
    0
  )
  const flashSavingsCents = Math.max(0, regularSubtotalCents - subtotalCents)
  // % de descuento Flash para el mensaje visible de no-acumulación.
  const flashPct =
    regularSubtotalCents > 0
      ? Math.round((flashSavingsCents / regularSubtotalCents) * 100)
      : 0
  // Descuento del cupón sobre el subtotal REGULAR, como el server.
  const couponDiscountCents = coupon
    ? Math.min(regularSubtotalCents, Math.round(regularSubtotalCents * (coupon.discount_percent / 100)))
    : 0
  const loyaltyDiscountCents = loyaltyPercent
    ? Math.min(regularSubtotalCents, Math.round(regularSubtotalCents * (loyaltyPercent / 100)))
    : 0
  // Ganador con 3 competidores (igual que createOrder): flash, cupón, FID-.
  const flashWins =
    flashSavingsCents > 0 &&
    flashSavingsCents >= loyaltyDiscountCents &&
    flashSavingsCents >= couponDiscountCents
  const couponWins = !flashWins && couponDiscountCents > 0 && couponDiscountCents >= loyaltyDiscountCents
  const loyaltyWins = !flashWins && !couponWins && loyaltyDiscountCents > 0
  const promoDiscountCents = couponWins ? couponDiscountCents : loyaltyWins ? loyaltyDiscountCents : 0
  const baseSubtotalCents = couponWins || loyaltyWins ? regularSubtotalCents : subtotalCents
  const adjustedTotalCents = Math.max(0, baseSubtotalCents - promoDiscountCents - pointsDiscountCents)

  const shipping = adjustedTotalCents > 0 ? SHIPPING_FLAT_CENTS : 0
  const grandTotal = adjustedTotalCents + shipping

  return {
    regularSubtotalCents,
    flashSavingsCents,
    flashPct,
    couponDiscountCents,
    loyaltyDiscountCents,
    flashWins,
    couponWins,
    loyaltyWins,
    promoDiscountCents,
    baseSubtotalCents,
    adjustedTotalCents,
    shipping,
    grandTotal,
  }
}
