/**
 * GET /api/flash-codes/[code]/products
 * POST /api/flash-codes/[code]/products  body: { product_id }
 * DELETE /api/flash-codes/[code]/products/[productId]
 *
 * Gestiona las asociaciones entre un código flash y sus productos (flash_code_products).
 * Solo admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'

export const runtime = 'nodejs'

/**
 * GET — Retorna:
 * - associated: productos vinculados a este código (con datos completos)
 * - available: todos los productos del catálogo (para el selector admin)
 * - flashCode: datos del código flash (type, discount_percent)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  // Verificar que el código flash existe
  const fc = await queryOne<any>(`SELECT code, type, discount_percent FROM flash_codes WHERE code = $1`, [cleanCode])
  if (!fc) {
    return NextResponse.json({ ok: false, error: 'Código flash no encontrado' }, { status: 404 })
  }

  // Productos asociados
  const associated = await query<any>(`
    SELECT
      fcp.product_id AS id,
      p.slug, p.title, p.price_cents, p.condition, p.active,
      COALESCE(i.stock, 0) AS stock
    FROM flash_code_products fcp
    JOIN products p ON p.id = fcp.product_id
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE fcp.code = $1
    ORDER BY p.title ASC
  `, [cleanCode])

  // Todos los productos (para el selector)
  const allProducts = await query<any>(`
    SELECT
      p.id, p.slug, p.title, p.price_cents, p.condition, p.active,
      COALESCE(i.stock, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.active DESC, p.title ASC
  `)

  return NextResponse.json({
    ok: true,
    flashCode: {
      code: fc.code,
      type: fc.type,
      discount_percent: fc.discount_percent !== null ? Number(fc.discount_percent) : null,
    },
    associated,
    available: allProducts,
  })
}

/**
 * POST — Asocia un producto al código flash.
 * Body: { product_id: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  let body: { product_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.product_id) {
    return NextResponse.json({ ok: false, error: 'product_id requerido' }, { status: 400 })
  }

  // Validar UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(body.product_id)) {
    return NextResponse.json({ ok: false, error: 'product_id inválido (no es un UUID)' }, { status: 400 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  // Verificar que el código existe
  const fc = await queryOne<any>(`SELECT code FROM flash_codes WHERE code = $1`, [cleanCode])
  if (!fc) {
    return NextResponse.json({ ok: false, error: 'Código flash no encontrado' }, { status: 404 })
  }

  // Verificar que el producto existe
  const product = await queryOne<any>(`SELECT id FROM products WHERE id = $1`, [body.product_id])
  if (!product) {
    return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
  }

  try {
    await query(
      `INSERT INTO flash_code_products (code, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [cleanCode, body.product_id]
    )
    return NextResponse.json({ ok: true, code: cleanCode, product_id: body.product_id })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Error al asociar producto' }, { status: 500 })
  }
}

/**
 * DELETE — Elimina la asociación entre un código flash y un producto.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  // Leer product_id del search param: ?productId=xxx
  const url = new URL(_req.url)
  const productId = url.searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'productId requerido como query param' }, { status: 400 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  try {
    await query(
      `DELETE FROM flash_code_products WHERE code = $1 AND product_id = $2`,
      [cleanCode, productId]
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Error al desasociar producto' }, { status: 500 })
  }
}
