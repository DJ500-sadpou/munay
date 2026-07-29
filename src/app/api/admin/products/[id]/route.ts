/**
 * PUT /api/admin/products/[id]
 * Actualiza un producto + inventario (transaccional).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { transaction, isDbConfigured } from '@/lib/db/neon'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { slugify } from '@/lib/format'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function checkAdmin() {
  if (!isDbConfigured()) {
    return { ok: false, response: NextResponse.json({ error: 'DB no configurada' }, { status: 503 }) }
  }
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const user = await currentUser()
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { id } = await ctx.params

  let body: {
    slug: string
    title: string
    description?: string | null
    price_cents: number
    condition: 'new' | 'used'
    grading?: 'excelente' | 'buena' | 'regular' | null
    active: boolean
    stock: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validaciones
  if (!body.title || body.title.length < 3) {
    return NextResponse.json({ error: 'Título muy corto' }, { status: 400 })
  }
  if (isNaN(body.price_cents) || body.price_cents < 0) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }
  if (!['new', 'used'].includes(body.condition)) {
    return NextResponse.json({ error: 'Condición inválida' }, { status: 400 })
  }

  try {
    // Fix CRIT-4 / FLOW2-013: usar transaction real (no stub upsert no-op).
    await transaction(async (tx) => {
      await tx`
        UPDATE products
        SET slug = ${slugify(body.title)},
            title = ${body.title},
            description = ${body.description ?? null},
            price_cents = ${body.price_cents},
            condition = ${body.condition},
            grading = ${body.grading ?? null},
            active = ${body.active}
        WHERE id = ${id}
      `
      // Upsert de inventario real con INSERT ... ON CONFLICT DO UPDATE.
      await tx`
        INSERT INTO inventory (product_id, stock, reserved)
        VALUES (${id}, ${Math.max(0, body.stock ?? 0)}, 0)
        ON CONFLICT (product_id)
        DO UPDATE SET stock = EXCLUDED.stock, updated_at = now()
      `
    })

    return NextResponse.json({ ok: true, id })
  } catch (err: any) {
    console.error('[admin/products] update error:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/products/[id]
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { id } = await ctx.params

  try {
    const { query } = await import('@/lib/db/neon')
    await query(`DELETE FROM products WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
