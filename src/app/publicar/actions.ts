'use server'

import { currentUser } from '@clerk/nextjs/server'
import { createListing } from '@/lib/queries/user-listings'
import type { ListingCondition } from '@/types/user-listing'

export async function submitListing(_prev: any, formData: FormData) {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión' }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as string
  const condition = formData.get('condition') as string
  const price = formData.get('price') as string
  const size = formData.get('size') as string
  const brand = formData.get('brand') as string

  if (!title || !category || !condition || !price) {
    return { ok: false, error: 'Completa todos los campos requeridos' }
  }

  const priceCents = Math.round(parseFloat(price) * 100)
  if (isNaN(priceCents) || priceCents < 0) {
    return { ok: false, error: 'Precio inválido' }
  }

  try {
    const listing = await createListing({
      userId: user.id,
      title: title.trim(),
      description: description?.trim() || undefined,
      category,
      condition: condition as ListingCondition,
      price_cents: priceCents,
      size: size || undefined,
      brand: brand?.trim() || undefined,
    })

    if (!listing) {
      return { ok: false, error: 'Error al publicar la prenda' }
    }

    return { ok: true, listing }
  } catch {
    return { ok: false, error: 'Error interno. Intenta de nuevo.' }
  }
}
