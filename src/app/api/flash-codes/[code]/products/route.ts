/**
 * GET /api/flash-codes/[code]/products
 * POST /api/flash-codes/[code]/products  body: { product_id, precio_especial_cents? }
 * DELETE /api/flash-codes/[code]/products/[productId]
 *
 * Gestiona las asociaciones entre un código flash y sus productos (flash_code_products).
 * [F0/BLOQUE B] El precio especial por producto (precio_especial_cents) se puede
 * fijar/actualizar al asociar. NULL → se usa el price_cents del producto.
 * Solo admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
// [FIX Ronda 1] formatDate con timezone America/Guayaquil explícita
// (toLocaleDateString('es-EC') usaba la del servidor → fecha incorrecta
// en timestamps límite para el admin).
import { formatDate } from '@/lib/format'

export const runtime = 'nodejs'

/**
 * [FIX Ronda 2] Lógica de warning única (GET y POST la usan): el admin debe
 * saber cuándo los productos asociados AÚN no son visibles para el usuario
 * (código inactivo, no iniciado, expirado o agotado). Si cambia un mensaje o
 * un check, se actualiza en un solo lugar.
 */
function computeFlashCodeWarning(fc: {
  active: boolean
  starts_at: string
  ends_at: string
  max_uses: number | null
  uses_count: number
}): string | null {
  const now = new Date()
  if (!fc.active) {
    return 'El código está INACTIVO: los usuarios aún no podrán ver estos productos.'
  }
  if (new Date(fc.starts_at) > now) {
    return `El código aún no inicia (inicia el ${formatDate(fc.starts_at, { dateStyle: 'short' })}).`
  }
  if (new Date(fc.ends_at) < now) {
    return 'El código ya EXPIRÓ: los usuarios no podrán ver estos productos.'
  }
  if (fc.max_uses !== null && Number(fc.uses_count) >= Number(fc.max_uses)) {
    return 'El código ya AGOTÓ sus usos máximos: los usuarios no podrán ver estos productos.'
  }
  return null
}

/**
 * GET — Retorna:
 * - associated: productos vinculados a este código (con datos completos)
 * - available: todos los productos del catálogo (para el selector admin)
 * - flashCode: datos del código flash (type='unlock', code)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  await requireAdmin()

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  // Verificar que el código flash existe + su vigencia (para el warning
  // "código no vigente" que el admin ve aunque no esté asociando).
  // [FIX Ronda 2] El GET ahora calcula el MISMO warning que el POST, así
  // loadData() refresca el aviso (antes quedaba obsoleto si el admin
  // activaba/vencía el código sin re-asociar).
  const fc = await queryOne<any>(`
    SELECT code, type, active, starts_at, ends_at, max_uses, uses_count
    FROM flash_codes WHERE code = $1
  `, [cleanCode])
  if (!fc) {
    return NextResponse.json({ ok: false, error: 'Código flash no encontrado' }, { status: 404 })
  }

  // [FIX Ronda 2] Mismo helper que el POST: warning único de código no vigente.
  const warning = computeFlashCodeWarning(fc)

  // Productos asociados (incluye precio_especial_cents — F0/BLOQUE B)
  const associated = await query<any>(`
    SELECT
      fcp.product_id AS id,
      fcp.precio_especial_cents,
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
    },
    warning,
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
  await requireAdmin()

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  let body: { product_id?: string; precio_especial_cents?: number | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.product_id) {
    return NextResponse.json({ ok: false, error: 'product_id requerido' }, { status: 400 })
  }

  // Validar precio especial (F0/BLOQUE B): entero positivo o null/undefined
  let specialCents: number | null = null
  if (body.precio_especial_cents != null) {
    if (!Number.isInteger(body.precio_especial_cents) || body.precio_especial_cents < 0) {
      return NextResponse.json({ ok: false, error: 'precio_especial_cents inválido (entero >= 0)' }, { status: 400 })
    }
    specialCents = body.precio_especial_cents
  }

  // Validar UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(body.product_id)) {
    return NextResponse.json({ ok: false, error: 'product_id inválido (no es un UUID)' }, { status: 400 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 503 })
  }

  // Verificar que el código existe y su vigencia (para avisar al admin si el
  // código aún no es visible: inactivo, expirado o agotado).
  // [P1] La asociación NO se bloquea (el admin puede preparar códigos
  // futuros), pero el warning guía: "asociaste productos a un código que
  // los usuarios aún no pueden usar".
  const fc = await queryOne<any>(`
    SELECT code, active, starts_at, ends_at, max_uses, uses_count
    FROM flash_codes WHERE code = $1
  `, [cleanCode])
  if (!fc) {
    return NextResponse.json({ ok: false, error: 'Código flash no encontrado' }, { status: 404 })
  }

  // [FIX Ronda 2] Helper único (GET y POST): warning de código no vigente.
  const warning = computeFlashCodeWarning(fc)

  // Verificar que el producto existe
  const product = await queryOne<any>(`SELECT id FROM products WHERE id = $1`, [body.product_id])
  if (!product) {
    return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
  }

  try {
    // ON CONFLICT DO UPDATE: re-asociar el mismo producto actualiza el precio
    // especial (NULL → usar price_cents). PK = (code, product_id).
    await query(
      `INSERT INTO flash_code_products (code, product_id, precio_especial_cents)
       VALUES ($1, $2, $3)
       ON CONFLICT (code, product_id)
       DO UPDATE SET precio_especial_cents = EXCLUDED.precio_especial_cents`,
      [cleanCode, body.product_id, specialCents]
    )
    return NextResponse.json({
      ok: true,
      code: cleanCode,
      product_id: body.product_id,
      precio_especial_cents: specialCents,
      warning,
    })
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
  await requireAdmin()

  const { code } = await params
  const cleanCode = decodeURIComponent(code).toUpperCase()

  // Leer product_id del search param: ?productId=xxx
  const url = new URL(_req.url)
  const productId = url.searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'productId requerido como query param' }, { status: 400 })
  }

  // Validar UUID (consistente con POST)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(productId)) {
    return NextResponse.json({ ok: false, error: 'productId inválido (no es un UUID)' }, { status: 400 })
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
