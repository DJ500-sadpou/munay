/**
 * Tipos para el Marketplace P2P (Módulo 5).
 */

export type ListingStatus = 'pending' | 'verified' | 'published' | 'rejected'

export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair'

export const LISTING_CONDITIONS: Record<ListingCondition, string> = {
  new: 'Nuevo (con etiqueta)',
  like_new: 'Como nuevo (sin uso)',
  good: 'Buen estado',
  fair: 'Estado regular',
}

export const LISTING_CATEGORIES = [
  { value: 'chaquetas', label: 'Chaquetas' },
  { value: 'camisetas', label: 'Camisetas' },
  { value: 'pantalones', label: 'Pantalones' },
  { value: 'vestidos', label: 'Vestidos' },
  { value: 'faldas', label: 'Faldas' },
  { value: 'blusas', label: 'Blusas' },
  { value: 'accesorios', label: 'Accesorios' },
  { value: 'calzado', label: 'Calzado' },
  { value: 'otro', label: 'Otro' },
]

export const LISTING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', 'Única']

export interface UserListing {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string
  condition: ListingCondition
  price_cents: number
  currency: string
  images: string[]
  size: string | null
  brand: string | null
  status: ListingStatus
  verified_at: string | null
  verified_by: string | null
  rejection_reason: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PublishedListing extends UserListing {
  seller_email: string
  seller_name: string
}
