/**
 * POST /api/admin/products
 * Crea un nuevo producto + inventario (transaccional).
 * PUT /api/admin/products/[id] — ver [id]/route.ts
 *
 * Solo admins (verificación server-side con Clerk + tabla admins).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { transaction, isDbConfigured } from '@/lib/db/neon'
import { slugify } from '@/lib/format'

export const runtime = 'nodejs'

async function checkAdmin() {
  if (!isDbConfigured()) {
    return { ok: false, response: NextResponse.json({ error: 'DB no configurada' }, { status: 503 }) }
  }
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const user = await currentUser()
  const { checkAdminRow } = await import('@/lib/auth/admin-checks')
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true, userId }
}

export async function POST(req: NextRequest) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  let body: {
    slug: string
    title: string
    description?: string | null
    price_cents: number
    condition: 'new' | 'used'
    grading?: 'excelente' | 'buena' | 'regular' | null
    active: boolean
    stock: number
    images?: { url: string; public_id?: string; sort?: number }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validaciones
  const cleanCode = (body.slug ?? '').trim()
  if (cleanCode.length < 3 || cleanCode.length > 120) {
    return NextResponse.json({ error: 'El slug debe tener 3-120 caracteres' }, { status: 400 })
  }
  if (!body.title || body.title.length < 3) {
    return NextResponse.json({ error: 'Título muy corto' }, { status: 400 })
  }
  if (isNaN(body.price_cents) || body.price_cents < 0) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }
  if (!['new', 'used'].includes(body.condition)) {
    return NextResponse.json({ error: 'Condición inválida' }, { status: 400 })
  }
  if (body.grading && !['excelente', 'buena', 'regular'].includes(body.grading)) {
    return NextResponse.json({ error: 'Grading inválido' }, { status: 400 })
  }

  try {
    // Fix CRIT-4 / FLOW2-012: usar transaction de Neon real (no stub upsert no-op).
    const result = await transaction(async (tx) => {
      const productRows = await tx`
        INSERT INTO products (slug, title, description, price_cents, currency, condition, grading, active)
        VALUES (${slugify(body.title)}, ${body.title}, ${body.description ?? null},
                ${body.price_cents}, 'USD', ${body.condition},
                ${body.grading ?? null}, ${body.active})
        RETURNING id, slug
      `
      const product = productRows[0]
      await tx`
        INSERT INTO inventory (product_id, stock, reserved)
        VALUES (${product.id}, ${Math.max(0, body.stock ?? 0)}, 0)
      `

      // Guardar imágenes en product_images
      if (body.images && body.images.length > 0) {
        for (const img of body.images) {
          await tx`
            INSERT INTO product_images (product_id, url, public_id, sort)
            VALUES (${product.id}, ${img.url}, ${img.public_id ?? null}, ${img.sort ?? 0})
          `
        }
      }

      return product
    })

    return NextResponse.json({ ok: true, id: result.id, slug: result.slug })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un producto con ese slug' }, { status: 409 })
    }
    console.error('[admin/products] create error:', err)
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}

/**
 * GET /api/admin/products
 * Lista todos los productos (solo admin).
 */
export async function GET() {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { query } = await import('@/lib/db/neon')
  const products = await query<any>(`
    SELECT p.id, p.slug, p.title, p.price_cents, p.condition, p.grading, p.active,
           COALESCE(i.stock, 0) AS stock,
           COALESCE(
             (SELECT json_agg(json_build_object('url', pi.url, 'sort', pi.sort) ORDER BY pi.sort)
              FROM product_images pi WHERE pi.product_id = p.id),
             '[]'::json
           ) AS images
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.created_at DESC
  `)
  return NextResponse.json({ ok: true, data: products })
}
