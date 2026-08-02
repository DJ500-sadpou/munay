/**
 * PATCH /api/admin/brands/[id]
 * Activa/desactiva una marca (toggle). No borra marcas: una marca inactiva
 * no puede asignarse a productos nuevos, pero no rompe los que ya la tienen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { setBrandActive } from '@/lib/queries/brands'

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
  const { checkAdminRow } = await import('@/lib/auth/admin-checks')
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { id } = await ctx.params

  let body: { activo?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.activo !== 'boolean') {
    return NextResponse.json({ error: 'El campo activo debe ser booleano' }, { status: 400 })
  }

  try {
    const updated = await setBrandActive(id, body.activo)
    if (!updated) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, id, activo: body.activo })
  } catch (err: any) {
    console.error('[admin/brands] toggle error:', err)
    return NextResponse.json({ error: 'Error al actualizar la marca' }, { status: 500 })
  }
}
