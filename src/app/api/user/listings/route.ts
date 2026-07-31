import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { createListing } from '@/lib/queries/user-listings'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Debes iniciar sesión para publicar' },
        { status: 401 }
      )
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 500 })
    }

    const body = await req.json()
    const { title, description, category, condition, priceCents, images, size, brand } = body

    // Validaciones
    if (!title || title.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'El título debe tener al menos 3 caracteres' },
        { status: 400 }
      )
    }
    if (!category) {
      return NextResponse.json(
        { ok: false, error: 'Selecciona una categoría' },
        { status: 400 }
      )
    }
    if (!condition) {
      return NextResponse.json(
        { ok: false, error: 'Selecciona el estado de la prenda' },
        { status: 400 }
      )
    }
    if (priceCents === undefined || priceCents < 0) {
      return NextResponse.json(
        { ok: false, error: 'Ingresa un precio válido' },
        { status: 400 }
      )
    }

    const listing = await createListing({
      userId: user.id,
      title: title.trim(),
      description: description?.trim() || undefined,
      category,
      condition,
      price_cents: Math.round(Number(priceCents)),
      images: images ?? [],
      size: size || undefined,
      brand: brand?.trim() || undefined,
    })

    if (!listing) {
      return NextResponse.json(
        { ok: false, error: 'Error al crear la publicación' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, listing })
  } catch (err) {
    console.error('[api/user/listings] Error:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
