/**
 * /api/admin/brands
 * GET  — lista todas las marcas (admin)
 * POST — crea una marca (admin)
 *
 * [FIX R5] Mismo patrón de autorización que /api/admin/products:
 * auth() + currentUser() + checkAdminRow (no requireAdmin, que es de páginas).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { slugify } from '@/lib/format'
import { listAllBrandsForAdmin, createBrand } from '@/lib/queries/brands'

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
  return { ok: true }
}

export async function GET() {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!
  const brands = await listAllBrandsForAdmin()
  return NextResponse.json({ ok: true, data: brands })
}

export async function POST(req: NextRequest) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  let body: { nombre?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const nombre = (body.nombre ?? '').trim()
  if (nombre.length < 1 || nombre.length > 100) {
    return NextResponse.json({ error: 'El nombre debe tener entre 1 y 100 caracteres' }, { status: 400 })
  }
  // [FIX R3] Un nombre sin caracteres alfabéticos (ej. "!!!") genera un slug
  // vacío → CHECK constraint del schema → 500. Validar acá con 400 amigable.
  if (!slugify(nombre)) {
    return NextResponse.json({ error: 'El nombre debe contener letras o números' }, { status: 400 })
  }

  try {
    const created = await createBrand(nombre)
    return NextResponse.json({ ok: true, ...created })
  } catch (err: any) {
    // 23505: unique en lower(nombre) o en slug → nombre/slug duplicado.
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una marca con ese nombre' }, { status: 409 })
    }
    console.error('[admin/brands] create error:', err)
    return NextResponse.json({ error: 'Error al crear la marca' }, { status: 500 })
  }
}
