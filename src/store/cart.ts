/**
 * Carrito de compras — store global con Zustand + persistencia en localStorage.
 *
 * Estructura de cada línea:
 *   { id, slug, title, unit_price_cents, qty, image_url? }
 *
 * La cantidad máxima por línea y por carrito está limitada por LIMITS.
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
}

export interface CartFlashCode {
  code: string
  type: 'discount' | 'unlock'
  discount_percent: number | null
  discount_cents: number | null
}

interface CartState {
  lines: CartLine[]
  flashCode: CartFlashCode | null
  // Acciones
  addItem: (item: Omit<CartLine, 'qty'> & { qty?: number }) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clear: () => void
  setFlashCode: (code: CartFlashCode | null) => void
  // Selectores
  totalItems: () => number
  subtotalCents: () => number
  discountCents: () => number
  totalCents: () => number
  pointsToEarn: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      flashCode: null,

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

      clear: () => set({ lines: [], flashCode: null }),

      setFlashCode: (code) => set({ flashCode: code }),

      totalItems: () => get().lines.reduce((s, l) => s + l.qty, 0),

      subtotalCents: () =>
        get().lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0),

      discountCents: () => {
        const fc = get().flashCode
        if (!fc) return 0
        const subtotal = get().subtotalCents()
        if (fc.type === 'discount') {
          if (fc.discount_percent != null) {
            return Math.round(subtotal * (fc.discount_percent / 100))
          }
          if (fc.discount_cents != null) {
            return Math.min(subtotal, fc.discount_cents)
          }
        }
        return 0
      },

      totalCents: () => {
        const sub = get().subtotalCents()
        const disc = get().discountCents()
        return Math.max(0, sub - disc)
      },

      pointsToEarn: () => {
        const total = get().totalCents()
        return Math.floor(total / 100)
      },
    }),
    {
      name: 'munay-cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Solo persistir lines y flashCode (no las funciones)
      partialize: (state) => ({
        lines: state.lines,
        flashCode: state.flashCode,
      }),
    }
  )
)
