/**
 * POST /api/flash-codes
 * Crea un nuevo código flash.
 * GET /api/flash-codes
 * Lista todos los flash codes.
 *
 * Solo admins (Clerk + tabla admins).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { query, isDbConfigured } from '@/lib/db/neon'
import { checkAdminRow } from '@/lib/auth/admin-checks'
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
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function POST(req: NextRequest) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  // F0/BLOQUE B: los códigos flash son SOLO 'unlock'. No se aceptan
  // discount_percent/discount_cents (los descuentos viven en coupons).
  let body: {
    code: string
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

  const cleanCode = (body.code ?? '').trim().toUpperCase()
  if (cleanCode.length < 4 || cleanCode.length > 32) {
    return NextResponse.json({ error: 'El código debe tener 4-32 caracteres' }, { status: 400 })
  }
  if (!/^[A-Z0-9]+$/.test(cleanCode)) {
    return NextResponse.json({ error: 'Solo letras mayúsculas y números' }, { status: 400 })
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
    // Fix FLOW3-002: query directa Neon (no stub).
    await query(`
      INSERT INTO flash_codes (
        code, type, starts_at, ends_at, max_uses, uses_count, active
      ) VALUES ($1, 'unlock', $2, $3, $4, 0, $5)
    `, [
      cleanCode,
      startsAt.toISOString(),
      endsAt.toISOString(),
      body.max_uses ?? null,
      body.active,
    ])

    return NextResponse.json({ ok: true, code: cleanCode })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un código con ese nombre' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al crear código flash' }, { status: 500 })
  }
}

export async function GET() {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const flashCodes = await query<any>(`
    SELECT code, type, starts_at, ends_at, max_uses, uses_count, active
    FROM flash_codes
    ORDER BY created_at DESC
  `)

  return NextResponse.json({ ok: true, data: flashCodes })
}
