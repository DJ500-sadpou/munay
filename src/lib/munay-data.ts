/**
 * Datos de presentación de la landing MUNAY.
 * Solo UI (demo) — sin backend.
 */

import {
  LayoutGrid,
  Shirt,
  Footprints,
  ShoppingBag,
  Watch,
  Sparkles,
  Tags,
  type LucideIcon,
} from 'lucide-react'

export type Category = {
  label: string
  icon: LucideIcon
  href: string
}

// [P1] Íconos de la landing: cada categoría lleva al catálogo YA FILTRADO
// con `?categoria=<value>` (el valor viene del vocabulario canónico
// src/lib/categories.ts). "Marcas" va a la página de selección /marcas.
export const CATEGORIES: Category[] = [
  { label: 'Todas', icon: LayoutGrid, href: '/catalogo' },
  { label: 'Chaquetas', icon: Shirt, href: '/catalogo?categoria=chaquetas' },
  { label: 'Tops', icon: Shirt, href: '/catalogo?categoria=tops' },
  { label: 'Pantalones', icon: Tags, href: '/catalogo?categoria=pantalones' },
  { label: 'Zapatillas', icon: Footprints, href: '/catalogo?categoria=zapatillas' },
  { label: 'Bolsos', icon: ShoppingBag, href: '/catalogo?categoria=bolsos' },
  { label: 'Vestidos', icon: Sparkles, href: '/catalogo?categoria=vestidos' },
  { label: 'Accesorios', icon: Watch, href: '/catalogo?categoria=accesorios' },
  { label: 'Marcas', icon: Tags, href: '/marcas' },
]

export type LiveCode = {
  code: string
  discount: string
  note: string
  used: number
  total: number
}

export const LIVE_CODES: LiveCode[] = [
  { code: 'MUNAYLIVE20', discount: '20% OFF', note: 'Mín. $10.000', used: 64, total: 150 },
  { code: 'PINTA10', discount: '10% OFF', note: 'Sin mínimo', used: 120, total: 300 },
  { code: 'MUNAYVIP', discount: '25% OFF', note: 'Mín. $20.000', used: 32, total: 100 },
]

export type Testimonial = {
  name: string
  initials: string
  quote: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Camila R.',
    initials: 'CR',
    quote: 'La calidad de las prendas es increíble y el envío súper rápido. ¡Me encanta!',
  },
  {
    name: 'Tomás G.',
    initials: 'TG',
    quote: 'Los códigos en vivo son lo más. Siempre encuentro ofertas buenísimas.',
  },
  {
    name: 'Sofi L.',
    initials: 'SL',
    quote: 'Me da mucha confianza que higienicen y verifiquen cada prenda.',
  },
]

export type Metric = { value: string; label: string }

export const METRICS: Metric[] = [
  { value: '50K+', label: 'Miembros activos' },
  { value: '10K+', label: 'Prendas disponibles' },
  { value: '99.9%', label: 'Compras protegidas' },
  { value: '750K+', label: 'Prendas vendidas' },
]
