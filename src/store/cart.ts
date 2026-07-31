/**
 * Carrito de compras — store global con Zustand + persistencia en localStorage.
 *
 * Estructura de cada línea:
 *   { id, slug, title, unit_price_cents, qty, image_url? }
 *
 * La cantidad máxima por línea y por carrito está limitada por LIMITS.
 *
 * [F3] Separación Cupones vs Código Flash:
 *   - Se ELIMINÓ flashCode / discountCents del store. Los códigos flash ya
 *     NO aplican descuento en el checkout (son mecanismo de descubrimiento:
 *     búsqueda → /flash/[code]). Los descuentos (cupón general o cupón de
 *     fidelidad) se validan contra el servidor en /checkout y se consumen en
 *     createOrder.
 *   - version: 2 → invalida el estado persistido en localStorage que aún
 *     contenía flashCode (FIX #8).
 *   - version: 3 → [BLOQUE B] invalida carritos con precio descontado sin
 *     flash_code (líneas pre-fix que cobraban precio completo).
 */

'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LIMITS } from '@/lib/constants'

export interface CartLine {
  id: string
  slug: string
  title: string
  unit_price_cents: number
  qty: number
  image_url?: string | null
  condition: 'new' | 'used'
  /** Código flash que desbloqueó el precio especial de esta línea (F0/BLOQUE B).
   *  Se envía al server para que createOrder aplique precio_especial_cents
   *  de forma autoritativa (sin confiar en el precio del cliente). */
  flash_code?: string | null
}

interface CartState {
  lines: CartLine[]
  // Acciones
  addItem: (item: Omit<CartLine, 'qty'> & { qty?: number }) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clear: () => void
  // Selectores
  totalItems: () => number
  subtotalCents: () => number
  totalCents: () => number
  pointsToEarn: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      addItem: (item) =>
        set((state) => {
          const qty = item.qty ?? 1
          const existing = state.lines.find((l) => l.id === item.id)
          if (existing) {
            const newQty = Math.min(LIMITS.maxItemsPerCart, existing.qty + qty)
            return {
              lines: state.lines.map((l) =>
                l.id === item.id ? { ...l, qty: newQty } : l
              ),
            }
          }
          const newLines = [...state.lines, { ...item, qty }]
          // Limitar total de líneas
          if (newLines.length > LIMITS.maxItemsPerCart) {
            newLines.splice(0, newLines.length - LIMITS.maxItemsPerCart)
          }
          return { lines: newLines }
        }),

      removeItem: (id) =>
        set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),

      updateQty: (id, qty) =>
        set((state) => {
          if (qty <= 0) {
            return { lines: state.lines.filter((l) => l.id !== id) }
          }
          return {
            lines: state.lines.map((l) =>
              l.id === id ? { ...l, qty: Math.min(LIMITS.maxItemsPerCart, qty) } : l
            ),
          }
        }),

      clear: () => set({ lines: [] }),

      totalItems: () => get().lines.reduce((s, l) => s + l.qty, 0),

      subtotalCents: () =>
        get().lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0),

      // [F3] Sin descuentos en el store: el total es el subtotal.
      // Los descuentos se calculan en el checkout contra el servidor.
      totalCents: () => get().subtotalCents(),

      pointsToEarn: () => {
        const total = get().totalCents()
        return Math.floor(total / 100)
      },
    }),
    {
      name: 'munay-cart',
      storage: createJSONStorage(() => localStorage),
      // version 3: [BLOQUE B] invalida carritos persistidos con precio
      // descontado pero SIN flash_code (líneas pre-fix que seguían
      // cobrando precio completo en createOrder).
      // Solo persistir lines (ahora con flash_code por línea para
      // aplicar precio_especial_cents server-side en createOrder).
      partialize: (state) => ({
        lines: state.lines,
      }),
    }
  )
)
