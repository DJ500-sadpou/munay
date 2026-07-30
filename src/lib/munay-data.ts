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

export const CATEGORIES: Category[] = [
  { label: 'Todas', icon: LayoutGrid, href: '/catalogo' },
  { label: 'Chaquetas', icon: Shirt, href: '/catalogo?cat=chaquetas' },
  { label: 'Tops', icon: Shirt, href: '/catalogo?cat=tops' },
  { label: 'Pantalones', icon: Tags, href: '/catalogo?cat=pantalones' },
  { label: 'Zapatillas', icon: Footprints, href: '/catalogo?cat=zapatillas' },
  { label: 'Bolsos', icon: ShoppingBag, href: '/catalogo?cat=bolsos' },
  { label: 'Vestidos', icon: Sparkles, href: '/catalogo?cat=vestidos' },
  { label: 'Accesorios', icon: Watch, href: '/catalogo?cat=accesorios' },
  { label: 'Marcas', icon: Tags, href: '/catalogo?cat=marcas' },
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
