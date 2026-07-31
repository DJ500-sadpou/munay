/**
 * PUT /api/flash-codes/[code]
 * DELETE /api/flash-codes/[code]
 *
 * Solo admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { query, isDbConfigured } from '@/lib/db/neon'
import { checkAdminRow } from '@/lib/auth/admin-checks'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ code: string }>
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

  const { code } = await ctx.params
  const codeId = decodeURIComponent(code).toUpperCase()

  // F0/BLOQUE B: solo 'unlock', sin columnas discount.
  let body: {
    type?: 'unlock'
    starts_at: string
    ends_at: string
    max_uses?: number | null
    active: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const startsAt = new Date(body.starts_at)
  const endsAt = new Date(body.ends_at)
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: 'Fecha de fin debe ser posterior a inicio' }, { status: 400 })
  }

  try {
    await query(`
      UPDATE flash_codes SET
        type = 'unlock',
        starts_at = $2,
        ends_at = $3,
        max_uses = $4,
        active = $5
      WHERE code = $1
    `, [
      codeId,
      startsAt.toISOString(),
      endsAt.toISOString(),
      body.max_uses ?? null,
      body.active,
    ])

    return NextResponse.json({ ok: true, code: codeId })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al actualizar código flash' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const { code } = await ctx.params
  const codeId = decodeURIComponent(code).toUpperCase()

  try {
    await query(`DELETE FROM flash_codes WHERE code = $1`, [codeId])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al eliminar código flash' }, { status: 500 })
  }
}
